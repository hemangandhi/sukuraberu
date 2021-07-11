
function logEvent(evt_str) {
    var log = document.getElementById('event-log');
    var evt = document.createElement('li');
    evt.innerText = evt_str;
    log.appendChild(evt);
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
	    for (var j = 0; j < players[i].hand.length; j++) {
		var koma = players[i].hand[j];
		hand_elt.addKoma(new Koma(koma.face, koma.score, KomaState.MOCHI, false, koma.modifications));
	    }
	}
    }
    logEvent('Updated players list' + ((im_in_game) ? '': '. Enter a name and click "join game" to join.'));
}

function updateGame(hand_elt, my_name, game_data) {
    listPlayers(hand_elt, my_name, game_data);
};

function sendSocketData(ws, type, msg) {
    ws.send(JSON.stringify({'type': type, 'payload': msg}));
}

document.addEventListener("DOMContentLoaded", function(){

    var ws = new WebSocket("ws://" + window.location.host + "/ws");
    var my_name = "";
    var in_game = false;
    var join_button = document.getElementById("join-game");

    var hand_elt = document.getElementById('my-tiles');
    var hand_container = new KomaContainer(hand_elt, 7, KomaState.MOCHI);

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
	    updateGame(hand_container, my_name, g);
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
	    // TODO: commit move
	}
    });

    var cells = [];
    installBoard(document.getElementById('board'), function(sq_tag, sq_info) {
	sq_tag.id = 'cell-' + sq_info[0] + '-' + sq_info[1];
	cells.push(new BoardSquare(sq_tag, ...sq_info));
    });

});
