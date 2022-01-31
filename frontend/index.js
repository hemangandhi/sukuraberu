function addStrToHtmlList(list_id, str) {
    var log = document.getElementById(list_id);
    var evt = document.createElement('li');
    evt.innerText = str;
    log.appendChild(evt);
}

function logEvent(evt_str) {
    addStrToHtmlList('event-log', evt_str);
}

function komaOfPyTile(py_tile, state, is_public) {
    return new Koma((py_tile.face == '' && py_tile.blank_tile_modification) ? py_tile.blank_tile_modification : py_tile.face, py_tile.score, state, is_public, py_tile.modifications);
}

function listPlayers(hand_elt, my_name, players_msg){
    var players = players_msg.players;
    var players_elt = document.getElementById('players');
    players_elt.innerHTML = '';
    var im_in_game = false;
    for(var i = 0; i < players.length; i++) {
	var player_li = document.createElement('li');
	player_li.innerText = players[i].name + '(' + players[i].score + ')';
	players_elt.appendChild(player_li);

	if (players[i].name === my_name) {
	    im_in_game = true;
	    for (var j = hand_elt.koma_list.length; j < players[i].hand.length; j++) {
		var koma = players[i].hand[j];
		hand_elt.addKoma(komaOfPyTile(players[i].hand[j], KomaState.MOCHI, false));
	    }
	}
    }
    logEvent('Updated players list' + ((im_in_game) ? '': '. Enter a name and click "join game" to join.'));
}

function updateGame(hand_elt, my_name, cells, turn_button, game_data) {
    listPlayers(hand_elt, my_name, game_data);
    document.getElementById('word-list').innerHTML = '';
    for (var i = 0; i < game_data.words.length; i++) {
	var word = game_data.words[i]
	addStrToHtmlList('word-list', word.characters);
        var point = word.first_character_point;
	for(var j = 0; j < word.tiles.length; j++, point[(word.is_vertical)? 0: 1]++) {
	    var cell = cells.get(hashPt(point));
	    // Assumption: it's alright. So we don't have to care about this
	    // overlap/tile re-use.
	    if (cell.koma_list.length == 0) {
		cell.addKoma(komaOfPyTile(word.tiles[j], KomaState.UTTA, true));
	    } else {
		cell.koma_list[0].state = KomaState.UTTA;
		cell.koma_list[0].is_public = true;
		cell.koma_elt.setAttribute('draggable', false);
	    }
	}
    }
    var curr_player_name = game_data.players[game_data.turn].name;
    if (curr_player_name === my_name) {
	document.getElementById('whose-turn').innerText = "It's your turn!";
	turn_button.disabled = false;
    } else {
	document.getElementById('whose-turn').innerText = "It's " + curr_player_name + "'s turn.";
	turn_button.disabled = true;
    }
    logEvent('Updated game state');
};

function sendSocketData(ws, type, msg) {
    ws.send(JSON.stringify({'type': type, 'payload': msg}));
}

document.addEventListener("DOMContentLoaded", function(){

    var ws = new WebSocket("ws://" + window.location.host + "/ws");
    var my_name = "";
    var in_game = false;
    // AKA the button for starting the game and committing turns.
    var join_button = document.getElementById("join-game");

    var hand_elt = document.getElementById('my-tiles');
    var hand_container = new KomaContainer(hand_elt, 7, KomaState.MOCHI);

    var cells = new Map();
    installBoard(document.getElementById('board'), function(sq_tag, sq_info) {
	sq_tag.id = 'cell-' + sq_info[0] + '-' + sq_info[1];
	cells.set(hashPt([sq_info[0], sq_info[1]]), new BoardSquare(sq_tag, ...sq_info));
    });

    var turn_commiter = new TurnCommitter(function(t, p) { sendSocketData(ws, t, p);}, "tile-modifiers")

    ws.onmessage = function(event) {
	console.log(event);
	var data = JSON.parse(event.data);
	var handlers = {};
	handlers["error"] = function(err) { logEvent("Error: " + err); };
	handlers["player-list"] = function(l) { listPlayers(hand_container, my_name, l); }
	handlers["game-state"] = function(g) {
	    // In case somebody else started the game.
	    in_game = true;
	    join_button.value = "Commit move";
	    updateGame(hand_container, my_name, cells, join_button, g);
	};
	handlers[data.type](data.payload);
    }

    join_button.addEventListener('click', function(ce) {
	if (my_name === "") {
	    var input = document.getElementById('name');
	    input.disabled = true;
	    my_name = input.value;
	    sendSocketData(ws, 'join', {'name': my_name});
	    join_button.value = "Start game!";
	} else if (!in_game) {
	    in_game = true;
	    join_button.value = "Commit move";
	    sendSocketData(ws, 'start-game', true);
	} else {
	    if (turn_commiter.isInCommit()) return;
	    turn_commiter.startTurnCommit(cells);
	}
    });

});
