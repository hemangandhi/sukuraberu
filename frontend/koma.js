// Koma states:
// 1) kakushi-koma (still in the bag)
// 2) mochi-koma (in a player's hand)
// 3) tanin-koma (seeing somebody else's pieces)
// 4) tameshi-koma (being tried on the board)
// 5) utta-koma
//
// Transitions:
// 1->2: dealt a koma
// 2->3: share hand with others
// 2->4: try to play from a closed hand
// 3->4: try to play from an open hand (or somebody else does)
// 4->2: cancel a play with a closed hand
// 4->3: cancel a play with an open hand
// 4->5: commit a play
//
// Interaction with dragging:
// - Unoccupied board cells are dropped into for the transitions into 4.

var KomaState = {
    KAKUSHI: 1,
    MOCHI: 2,
    TANIN: 4,
    TAMESHI: 8,
    UTTA:16
};

// @dataclass # T_T
function Koma(label, score, state, is_public, mods) {
    this.label = label;
    this.score = score;
    this.mods = mods;
    this.state = state;
    // If state was ever KomaState.TANIN
    this.is_public = is_public;
}

var currently_dragged = null;
var current_drop = null;

function KomaContainer(hand_elt, nkoma_limit, for_koma_state) {

    this.koma_list = [];
    this.limit = nkoma_limit;
    this.n_koma = 0;

    var _this = this;
    function makeKomaDraggable(koma, koma_elt) {
	koma_elt.setAttribute('draggable', true);
	koma_elt.addEventListener('dragstart', function(evt) {
	    evt.dataTransfer.setData("text", JSON.stringify(koma));
	    evt.effectAllowed = "move";
	    evt.dataTransfer.dropEffect = "move";
	    _this.n_koma--;
	    for (var i = 0; i < _this.koma_list.length; i++) {
		if (_this.koma_list[i] == koma) {
		    _this.koma_list.splice(i, 1);
		    break;
		}
	    }
	    currently_dragged = koma;
	});
	koma_elt.addEventListener('dragend', function(evt) {
	    evt.dataTransfer.clearData();
	    // This means we've yet to drop, so we just want to cancel the drag.
	    if (currently_dragged != null) {
		if (current_drop != null) {
		    current_drop.style.border = "solid grey";
		    current_drop = null;
		}
		return;
	    }
	    // Weirdness: this is for slightly better effects since we don't want the element to vanish when the user starts dragging it?
	    // It casuses a slight inconsistency between the list in the container and the actual elements, but this even should always
	    // fire and make everything eventually consistent.
	    hand_elt.removeChild(koma_elt);
	});
    }

    // Make sure that when we're returning a koma to a hand, we're putting public ones
    // publically and private ones privately.
    // (NOTE: this split will not exist for the person who's sharing their hand.)
    function validKomaState(koma) {
	if (koma.is_public)
	    return (KomaState.MOCHI & for_koma_state) == 0
	else
	    return (KomaState.TANIN & for_koma_state) == 0
    }

    this.addKoma = function(koma) {
	if (this.n_koma == this.limit || !validKomaState(koma)) return;
	this.n_koma++;
	var koma_elt = document.createElement('div');
	koma_elt.innerText = koma.label + '(' + koma.score + ')';
	koma_elt.classList.add('koma-tag');
	// Expectation: we shouldn't see a kakushi koma here.
	// 17 = KomaState.KAKUSHI | Komastate.UTTA
	if ((for_koma_state & 17) === 0) {
	    makeKomaDraggable(koma, koma_elt);
	}
	hand_elt.appendChild(koma_elt);
	this.koma_list.push(koma);
    }

    hand_elt.addEventListener('drop', function(evt) {
	evt.preventDefault();
	var koma = JSON.parse(evt.dataTransfer.getData('text'));
	koma.state = for_koma_state;
	_this.addKoma(koma);
	currently_dragged = null;
    });

    hand_elt.addEventListener('dragenter', function(evt) {
	hand_elt.style.border = "solid black";
	current_drop = hand_elt;
	evt.preventDefault();
    });
    hand_elt.addEventListener('dragover', function(evt) {
	evt.preventDefault();
    });
    hand_elt.addEventListener('dragleave', function(evt) {
	hand_elt.style.border = "solid grey";
	current_drop = null;
	evt.preventDefault();
    });
}

function BoardSquare(sq_elt, row, col, word_mult, letter_mult) {
    KomaContainer.call(this, sq_elt, 1, KomaState.TAMESHI);
    sq_elt.classList.add('cell');
    if (word_mult > 1) {
	sq_elt.classList.add('word-bonus');
	sq_elt.innerText = word_mult + 'W';
    }
    if (letter_mult > 1) {
	sq_elt.classList.add('letter-bonus');
	sq_elt.innerText = letter_mult + 'L';
    }

    this.word_mult = word_mult;
    this.letter_mult = letter_mult;
    this.row = row;
    this.col = col;

}
