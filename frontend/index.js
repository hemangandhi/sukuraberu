
function logEvent(evt_str) {
    var log = document.getElementById('event-log');
    var evt = document.createElement('li');
    evt.innerText = evt_str;
    log.appendChild(evt);
}

function listPlayers(players_msg){
    var players = players_msg.players;
    var players_elt = document.getElementById('players');
    players_elt.innerHTML = '';
    for(var i = 0; i < players.length; i++) {
	var player_li = document.createElement('li');
	player_li.innerText = players[i].name + '(' + players[i].score + ')';
	players_elt.appendChild(player_li);
    }
    logEvent('Updated players list');
}

function updateGame(game_data) {
    var game = JSON.parse(game_data);
};

function sendSocketData(ws, type, msg) {
    ws.send(JSON.stringify({'type': type, 'payload': msg}));
}

document.addEventListener("DOMContentLoaded", function(){

    var ws = new WebSocket("ws://" + window.location.host + "/ws");
    ws.onmessage = function(event) {
	console.log(event);
	var data = JSON.parse(event.data);
	var handlers = {};
	handlers["error"] = function(err) { logEvent("Error: " + err); },
	handlers["player-list"] = listPlayers,
	handlers["game-state"] = updateGame
	handlers[data.type](data.payload);
    }

    var myName = "";
    document.getElementById("join-game").addEventListener('click', function(ce) {
	if (myName === "") {
	    var input = document.getElementById('name');
	    input.disabled = true;
	    myName = input.value;
	    sendSocketData(ws, 'join', {'name': myName});
	} else {
	    // commit move
	}
    });

    var cells = [];
    installBoard(document.getElementById('board'), function(sq_tag, sq_info) {
	sq_tag.id = 'cell-' + sq_info[0] + '-' + sq_info[1];
	cells.push(new BoardSquare(sq_tag, ...sq_info));
    });

    var hand_elt = document.getElementById('my-tiles');
    var hand_container = new KomaContainer(hand_elt, 7, KomaState.MOCHI);
    for(var i = 0; i < 7; i++) {
	hand_container.addKoma(new Koma(i, i, KomaState.MOCHI, false));
    }
});
