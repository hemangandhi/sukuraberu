var BOARD_SIZE = 15;

// Because, of all things, JS hashmaps are strict about equality, so a hashmap of arrays is a bad idea.
// And this joy of a programming language totally lets me have my own == and hash, right?
function hashPt(pt) {
    // *sigh* yes, I could make out of bounds call to deliberately fail the hashmap lookup.
    if (pt[0] < 0 || pt[0] >= BOARD_SIZE || pt[1] < 0 || pt[1] >= BOARD_SIZE) return -1;
    return pt[0] * BOARD_SIZE + pt[1];
}

// OK, I even did this. (You know I'm distraught when I'm inverting a "hash function.")
function unhashPt(h) {
    return [Math.floor(h/BOARD_SIZE), h % BOARD_SIZE];
}

function extendOverQuandrants(top_left_squares) {
    var squares = [];
    for(var q = 0; q < 4; q++) {
	for(var i = 0; i < top_left_squares.length; i++) {
	    var sq = top_left_squares[i];
	    var r = (q % 2 != 0)? BOARD_SIZE - 1 - sq[0] : sq[0];
	    var c = (q >= 2)? BOARD_SIZE - 1 - sq[1] : sq[1];
	    squares.push([r, c, sq[2], sq[3]]);
	}
    }

    // sort | uniq
    return squares.sort(function(l, r) {
	var c = l[0] - r[0];
	if (c != 0) return c;
	return l[1] - r[1];
    }).filter(function (sq, pos, arr) {
	return pos == 0 || sq[0] != arr[pos - 1][0] || sq[1] != arr[pos - 1][1];
    });
}

// (row, column, word_multiplier, letter_multiplier)
// NOTE: this is sorted by row then column where each (row, column) appears at most once.
var SPECIAL_SQUARES = extendOverQuandrants([
    [0, 0, 3, 1],
    [0, 3, 1, 2],
    [0, 7, 3, 1],
    [1, 1, 2, 1],
    [1, 5, 1, 3],
    [2, 2, 2, 1],
    [2, 6, 1, 2],
    [3, 0, 1, 2],
    [3, 3, 2, 1],
    [3, 7, 1, 2],
    [4, 4, 2, 1],
    [5, 1, 1, 3],
    [5, 5, 1, 3],
    [6, 2, 1, 2],
    [6, 6, 1, 2],
    [7, 0, 3, 1],
    [7, 3, 1, 2],
    [7, 7, 2, 1]
]);

function installBoard(table_tag, square_ctor) {
    var special_square_idx = 0;
    for(var i = 0; i < BOARD_SIZE; i++) {
	var row = document.createElement('tr');
	for(var j = 0; j < BOARD_SIZE; j++) {
	    var square = document.createElement('td');
	    if (special_square_idx < SPECIAL_SQUARES.length
		&& i == SPECIAL_SQUARES[special_square_idx][0]
		&& j == SPECIAL_SQUARES[special_square_idx][1]) {
		square_ctor(square, SPECIAL_SQUARES[special_square_idx]);
		special_square_idx++;
	    } else {
		square_ctor(square, [i, j, 1, 1]);
	    }
	    row.appendChild(square);
	}
	table_tag.appendChild(row);
    }
}
