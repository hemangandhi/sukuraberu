import json
import logging
from aiohttp import web
import aiohttp

from game import *

app = web.Application()

class WebSocketHandler:
    def __init__(self):
        self.events = dict()
        self.ws = None
    def to_handler(self):
        async def handler(req):
            self.ws = web.WebSocketResponse()
            await self.ws.prepare(req)
            async for msg in self.ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    print(msg.data)
                    try:
                        m = json.loads(msg.data)
                        await self.events.get(m['type'], lambda x: {'type': 'error', 'payload': "Unexpected message: " + msg.data})(m['payload'])
                    except json.decoder.JSONDecodeError:
                        await self.ws.send_str(json.dumps({"type": 'error', "payload": "couldn't parse JSON"}))
            print('Otsukaresamadeshita')
            return self.ws
        return handler
                    
    def on(self, event_name):
        def wrap_event(fn):
            async def wrapped(evt):
                val = fn(evt)
                if val is not None:
                    await self.ws.send_str(json.dumps({"type": val[0], "payload": val[1]}))
            self.events[event_name] = wrapped
            return wrapped
        return wrap_event

sio = WebSocketHandler()
session = dict()

@sio.on('turn')
def handle_turn(turn_data):
    game = session.get('game')
    if game is None:
        return 'error', 'game has not started'
    try:
        words = []
        for js_word in turn_data:
            tile_list = [Tile(**t) for t in js_word['tiles']]
            word = Word(js_word['characters'], tile_list, tuple(js_word['first_character_point']), js_word['is_vertical'])
            words.append(word)
        game.play_turn(words)
    except TypeError:
        return 'error', 'invalid data'
    except ValueError as ve:
        return 'error', 'game play error: ' + str(ve)
    return 'game-state', game.to_dict()


@sio.on('join')
def handle_join(join_data):
    players = session.get('players')
    if players is None:
        session['players'] = []
    players = session['players']
    try:
        new_player = Player(**join_data)
    except TypeError:
        return 'error', 'invalid player description'
    players.append(new_player)

    game = session.get('game')
    if game is None:
        return 'player-list', {'players': [p.to_dict() for p in players]}
    else:
        game.deal_tiles(new_player)
        return 'game-state', game.to_dict()

@sio.on('start-game')
def handle_game_start(start):
    # 'start' is unused
    if 'game' in session:
        return 'error', 'game already started'
    if len(session.get('players', [])) == 0:
        return 'error', 'cannot start a game with no players!'
    session['game'] = make_default_scrabble(session['players'])
    return 'game-state', session['game'].to_dict()

# Order matters
app.add_routes([web.get('/ws', sio.to_handler())])
app.add_routes([web.static('/', '../frontend/')])

if __name__ == "__main__":
    web.run_app(app)
