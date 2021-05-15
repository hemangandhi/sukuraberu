import socketio

STATIC_fiLES = {
    '/': '../frontend/index.html',
    '/static': '../frontend/'
}

sio = socketio.AsyncServer()
app = socketio.ASGIApp(sio, static_files=STATIC_FILES)

def emit_returned_value(fn):
    def wrapt(data):
        v = fn(data)
        if v is not None:
            sio.emit(*v)
    return wrapt

@socket_io.on('turn')
@emit_returned_value('update_turn')
def handle_turn(sid, turn_data):
    async with sio.session(sid) as sess:
        if sess['game'] is None:
            return 'error', 'game is not yet set up'2
    

if __name__ == "__main__":
    socket_io.run(app)



