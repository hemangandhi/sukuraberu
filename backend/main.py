import socketio
import json

STATIC_fiLES = {
    '/': '../frontend/index.html',
    '/static': '../frontend/'
}

sio = socketio.AsyncServer()
app = socketio.ASGIApp(sio, static_files=STATIC_FILES)

session = dict()

def emit_returned_value(fn):
    def wrapt(data):
        v = fn(data)
        if v is not None:
            sio.emit(*v)
    return wrapt

@socket_io.on('turn')
@emit_returned_value()
def handle_turn(sid, turn_data):
    game = session.get('game')
    if game is None:
        return 'error', 'game has not started'

    try:
        js_word = json.loads(turn_data)
        tile_list = [Tile(**t) for t in js_word['tiles']]
        word = Word(js_word['characters'], tile_list, tuple(js_word['start_point']), js_word['is_vertical'])
        game.play_turn(word)
    except json.decoder.JSONDecodeError:
        return 'error', 'invalid JSON'
    except TypeError:
        return 'error', 'invalid data'
    except ValueError as ve:
        return 'error', 'game play error: ' + str(ve)
    

@socket_io.on('join')
@emit_returned_value()
def handle_join(sid, join_data):
    players = session.get('players')
    if players is None:
        session['players'] = []
    players = session['players']
    try:
        new_player = Player(**json.loads(join_data))
    except json.decoder.JSONDecodeError:
        return 'error', 'invalid JSON'
    except TypeError:
        return 'error', 'invalid player description'
    players.append(new_player)

    return 'player-list', json.dumps({'players': [p.to_dict() p in players]})

@socket_io.on('start-game')
@emit_returned_value
def handle_game_start(sid, start):
    if 'game' in session:
        return 'error', 'game already started'
    if len(session.get('players', [])) == 0:
        return 'error', 'cannot start a game with no players!'
    session['game'] = make_default_scrabble(session['players'])
    return 'game-state', json.dumps(session['game'].to_dict())

if __name__ == "__main__":
    socket_io.run(app)



