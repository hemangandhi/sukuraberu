from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit

app = Flask(__name__, static_url_path = '', static_folder='../frontend')
socket_io = SocketIO(app)

def emit_returned_value(event):
    def wrapper(fn):
        def wrapt(data):
            emit(fn(data))
        return wrapt
    return wrapper

@socket_io.on('turn')
@emit_returned_value('update_turn')
def handle_turn(turn_data):
    pass
    

if __name__ == "__main__":
    socket_io.run(app)



