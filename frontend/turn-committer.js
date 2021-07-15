// All these parallel arrays intersecting like words on a scrabble board T_T
// (nemo me impune)
//
// Turn state:
// 1) None: tiles are being played
// 2) Tiles: tiles are committed, they may be modified
// 3) Complete: the move is decided and sent to the server.

function replaceStrCharAt(str, char_val, at) {
    return str.slice(0, at) + char_val + str.slice(at + 1);
}

function vecAdd(l, r) {
    return [l[0] + r[0], l[1] + r[1]];
}

function vecScale(v, sc) {
    return [v[0] * sc, v[1] * sc];
}

function isPositiveDirection(d_vec) {
    return d_vec[0] + d_vec[1] > 0;
}

function runToWordEnd(point, cells, direction) {
    var cell;
    var res = [];
    for(var cp = vecAdd(point, direction);
	(cell = cells.get(hashPt(cp))) !== undefined && cell.koma_list.length > 0;
	cp = vecAdd(cp, direction)) {
	res.push({point: cp, koma: cell.koma_list[0]});
    }
    if (!isPositiveDirection(direction)) {
	return res.reverse();
    } else {
	return res;
    }
}

function neighboursOfPoint(point, cells, disallowed_directions) {
    var directions = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(function(d) {
	return disallowed_directions.some(function(bd) {
	    return d[0] == bd[0] && d[1] == bd[1];
	});
    });
    var nbd = [];
    for(var i = 0; i < directions.length; i++) {
	var new_pt = vecAdd(point, directions[i]);
	var cell = cells.get(hashPt(new_pt))
	if (cell !== undefined && cell.koma_list.length > 0) {
	    nbd.push({point: new_pt, direction: directions[i], koma: cell.koma_list[0]});
	}
    }
    return nbd;
}

function checkConnectednessOrFirstTurn(word_cells, cells) {
    var first_turn = true;
    for(let [hash, cell] of cells) {
	if (cell.koma_list.length > 0 && cell.koma_list[0].state !== KomaState.TAMESHI) {
	    first_turn = false;
	    break;
	}
    }

    if (first_turn) {
	if (!word_cells.some(function(c) {
	    var m = Math.floor(BOARD_SIZE/2);
	    return c.point[0] == m  && c.point[1] == m;
	})) {
	    return 'first move must use the center spot of the board';
	}
	return false;
    }

    var is_vertical = word_cells[0].point[0] !== word_cells[1].point[0];
    var ignore_directions = (is_vertical)?[[0, 1], [0, -1]]:[[1, 0], [-1, 0]];
    if (!word_cells.some(function(c) {
	// Technically:
	//
	// BAT
	//   ORE   <- ORE is valid, but word_cells wouldn't have the UTTA koma "T"
	//            that makes this valid, so we check the perpendicular neighboursOfPoint.
	return c.koma.state === KomaState.UTTA || neighboursOfPoint(c.point, cells, ignore_directions).length > 0;
    })) {
	return 'played tiles must cross previously played tiles';
    }
    return false;
}

function validateAndGetBaseWord(word_cells, cells) {
    // Technically, this should be already sorted as follows
    // since the hashmap is populated in the order and the JS Map
    // assures us that traversals are in insertion order. But I
    // don't like assuming hashmap traversal order.
    word_cells = word_cells.sort(function (l, r) {
	var c = l.point[0] - r.point[0];
	if (c != 0) return c;
	return l.point[1] - r.point[1];
    });

    if (word_cells.length == 0) return 'no tiles were played.';
    if (word_cells.length == 1) {
	var n = neighboursOfPoint(word_cells[0].point, cells, []);
	if (n.length == 0) return 'cannot play one letter words';
	if (isPositiveDirection(n[0].direction)) {
	    word_cells.push(n[0]);
	} else {
	    word_cells.splice(0, 0, n[0]);
	}
    }

    var is_vertical = word_cells[0].point[0] !== word_cells[1].point[0];
    if (!word_cells.every(function(c) {
	return word_cells[0].point[(!is_vertical)?0:1] == c.point[(!is_vertical)?0:1];
    })) {
	return 'they are not in one row or column.';
    }

    for(var i = 1; i < word_cells.length; i++) {
	var l = word_cells[i - 1].point[(!is_vertical)?1:0];
	var r = word_cells[i].point[(!is_vertical)?1:0];
	for (var j = l + 1; j < r; j++) {
	    var p = (!is_vertical)?[word_cells[0].point[0], j]:[j, word_cells[0].point[1]];
	    var cp = cells.get(hashPt(p));
	    if (cp.koma_list.length == 0) {
		return 'they do not connect to a piece on the board.';
	    }
	    // https://stackoverflow.com/a/586189
	    word_cells.splice(i, 0, {point: p, koma: cp.koma_list[0]});
	    i++;
	}
    }

    // Special case: the played tiles were a suffix
    var prefix = runToWordEnd(word_cells[0].point, cells, (!is_vertical)?[0, -1]:[-1, 0]);
    if (prefix.length > 0) {
	// https://stackoverflow.com/a/27647636
	Array.prototype.unshift.apply(word_cells, prefix);
    }
    var suffix = runToWordEnd(word_cells[word_cells.length - 1].point, cells, (!is_vertical)?[0, 1]:[1, 0]);
    for (var i = 0; i < suffix.length; i++) {
	// Can't concat since we are relying on the reference.
	word_cells.push(suffix[i]);
    }

    return checkConnectednessOrFirstTurn(word_cells, cells);
}

// Concept: turns are supposed to be played on a line, so the tiles played on this
// line for the "main word." Other words are formed by placing tiles. Consider:
//
// EMU
// N N     <- playing a "U" forms "NUN" and "MUD", both of which
// UDDER      must be scored. In this case, "NUN" would arbitrarily be the
// M E        "main word" (because it's hard to write big examples of this).
//   R
//
// Invariant: the "main word" is the last one.
function augmentWordList(cells, word_cells, total_words) {
    var is_vertical = word_cells[0].point[0] !== word_cells[1].point[0];
    var ignore_directions = (is_vertical)?[[0, 1], [0, -1]]:[[1, 0], [-1, 0]];
    var main_word = [];
    for (var i = 0; i < word_cells.length; i++) {
	if (word_cells[i].koma.state !== KomaState.TAMESHI) {
	    main_word.push({koma: word_cells[i].koma.label, cell_idx: -1, point: word_cells[i].point});
	    continue;
	}
	main_word.push({koma: word_cells[i].koma.label, cell_idx: i, point: word_cells[i].point});
	// This will have at most 2 values.
	var n = neighboursOfPoint(word_cells[i].point, cells, ignore_directions);
	if (n.length === 0) continue;
	var prefix = [], suffix = [];
	if (isPositiveDirection(n[0].direction)) {
	    suffix = runToWordEnd(word_cells[i].point, cells, n[0].direction);
	    if (n.length > 1) {
		prefix = runToWordEnd(word_cells[i].point, cells, n[1].direction);
	    }
	} else {
	    prefix = runToWordEnd(word_cells[i].point, cells, n[0].direction);
	    if (n.length > 1) {
		suffix = runToWordEnd(word_cells[i].point, cells, n[1].direction);
	    }
	}
	if (prefix.length == 0 && suffix.length == 0) continue;
	total_words.push(
	    prefix.map(function(p) { return {koma: p.koma, cell_idx: -1, point: p.point};})
		.concat([{koma: word_cells[i].koma, cell_idx: i, point: word_cells[i].point}])
		.concat(suffix.map(function(p) { return {koma: p.koma, cell_idx: -1, point: p.point};})));
    }
    total_words.push(main_word);
}

function yeetModForm(elt, commit_finisher, word_cells, played_words) {
    var main_word_span = document.createElement('span');
    main_word_span.id = 'main-word-span';
    var main_word_ol = document.createElement('ol');
    for(var i = 0; i < word_cells.length; i++) {
	// Help, I've fallen and I can't get up.
	// I also need a scope. Please don't ask too many questions.
	// "return" means the same thing as "continue" in this block. Sorry.
	(function () {
	    main_word_span.innerText += word_cells[i].koma.label;
	    var li = document.createElement('li');
	    if (word_cells[i].koma.mods.length == 1 ||
		(word_cells[i].koma.label == '' && word_cells[i].koma.state !== KomaState.UTTA)) {
		li.innerText = word_cells[i].koma.label + ' (cannot be changed)';
		main_word_ol.appendChild(li);
		return;
	    }

	    var main_selector = document.createElement('select');
	    var curr_selector = document.createElement('select');
	    if (word_cells[i].koma.label == '' && word_cells[i].koma.state !== KomaState.UTTA) {
		main_selector.id = 'main-word-blank-' + i;
		curr_selector.id = 'curr-word-blank-' + i;
	    }
	    main_selector.value = word_cells[i].koma.label;
	    curr_selector.value = word_cells[i].koma.label;
	    for (var mod_i = 0; mod_i < word_cells[i].koma.mods.length; mod_i++) {
		var opt = document.createElement('option');
		opt.value = word_cells[i].koma.mods.charAt(mod_i);
		opt.innerText = word_cells[i].koma.mods.charAt(mod_i);
		// Deep copy -- get that text node too.
		main_selector.appendChild(opt.cloneNode(true));
		curr_selector.appendChild(opt);
	    }

	    // Haha closure go brr -- we can't refer to i directly inside event handlers since
	    // it'll likely be word_cells.length.
	    var perma_i = i;
	    // To swap the blank word in the appropriate spot. Also initialize j to a value that
	    // indicates that we've not found another word at perma_i (in case we exit the loop
	    // early).
	    var j = played_words.length - 1, k;
	    main_selector.addEventListener('change', function(e) {
		var val = e.target.value;
		console.log(perma_i);
		var wd_span = document.getElementById('main-word-span');
		wd_span.innerText = replaceStrCharAt(wd_span.innerText, val, perma_i);
		if (word_cells[perma_i].koma.label === '' && j < played_words.length - 1) {
		    document.getElementById('curr-word-blank-' + perma_i).value = val;
		    var owd_span = document.getElementById('word-at-' + perma_i);
		    owd_span.innerText = replaceStrCharAt(owd_span.innerText, val, k);
		}
	    });
	    main_word_ol.appendChild(main_selector);
	    if (word_cells[i].koma.state === KomaState.UTTA) return;

	    for(j = 0; j < played_words.length - 1; j++) {
		for (k = 0; k < played_words[j].length; k++) {
		    if (played_words[j][k].cell_idx == i) {
			break;
		    }
		}
	    }
	    if (j == played_words.length - 1) return;

	    curr_selector.addEventListener('change', function(e) {
		var val = e.target.value;
		var wd_span = document.getElementById('word-at-' + perma_i);
		wd_span.innerText = replaceStrCharAt(wd_span.innerText, val, k);
		if (word_cells[perma_i].koma.label === '' && j < played_words.length - 1) {
		    document.getElementById('main-word-blank-' + perma_i).value = val;
		    var owd_span = document.getElementById('word-at-' + perma_i);
		    owd_span.innerText = replaceStrCharAt(owd_span.innerText, val, k);
		}
	    });
	    var curr_word_span = document.createElement('span');
	    curr_word_span.id = 'word-at-' + i;
	    var curr_word_ol = document.createElement('ol');
	    for (var k2 = 0; k2 < played_words[j].length; k2++) {
		curr_word_span.innerText += played_words[j][k2].koma.label;
		if (played_words[j][k2].cell_idx < 0) {
		    var li = document.createElement('li');
		    li.innerText = played_words[j][k2].koma.label + ' (cannot be changed)';
		    curr_word_ol.appendChild(li);
		} else {
		    curr_word_ol.appendChild(curr_selector);
		}
	    }
	    var curr_word_div = document.createElement('div');
	    curr_word_div.appendChild(curr_word_span);
	    curr_word_div.appendChild(curr_word_ol);
	    elt.appendChild(curr_word_div);
	})();
    } // for(var i... < word_cells.length...
    var main_word_div = document.createElement('div');
    main_word_div.appendChild(main_word_span);
    main_word_div.appendChild(main_word_ol);
    elt.appendChild(main_word_div);

    var button = document.createElement('input');
    button.setAttribute('type', 'button');
    button.value = "Done Modifying";
    button.addEventListener('click', function(e) {
	var main_word = document.getElementById('main-word-span').innerText;
	var words = [{str: main_word, cells: word_cells}];
	// j for consistency with the above disaster
	for (var j = 0; j < played_words.length - 1; j++) {
	    var i = played_words[j].filter(function (w) { return w.cell_idx >= 0 })[0].cell_idx;
	    var word = document.getElementById('word-at-' + i);
	    words.push({str: word, cells: played_words[j]});
	}
	commit_finisher(words);
    });
    elt.appendChild(button);
}

function pyTilesOfWordCells(cells, word) {
    return cells.map(function(cell, idx) {
	return {
	    face: cell.koma.label,
	    score: cell.koma.score,
	    modifications: cell.koma.mods,
	    blank_tile_modification: (cell.koma.label == '') ? word.charAt(idx) : null
	};
    });
}

function TurnCommitter(ws_msg_sender, tile_mod_form_elt_id) {
    var in_commit = false;
    var mod_form_elt = document.getElementById(tile_mod_form_elt_id);
    this.isInCommit = function() { return in_commit; }
    this.startTurnCommit = function(cells) {
	mod_form_elt.innerHTML = '';
	in_commit = true;
	var word_cells = [];
	for(let [hash, cell] of cells) {
	    var point = unhashPt(hash);
	    if (cell.koma_list.length > 0 && cell.koma_list[0].state == KomaState.TAMESHI) {
		word_cells.push({point: point, koma: cell.koma_list[0]});
	    }
	}
	var errs = validateAndGetBaseWord(word_cells, cells);
	if (errs) {
	    mod_form_elt.innerText = "Error in tile placement: " + errs;
	    in_commit = false;
	    return;
	}
	var played_words = [];
	augmentWordList(cells,word_cells, played_words);

	yeetModForm(mod_form_elt, function(wds) {
	    ws_msg_sender('turn', wds.map(function(wd) {
		return {
		    characters: wd.str,
		    tiles: pyTilesOfWordCells(wd.cells),
		    first_character_point: wd.cells[0].point,
		    is_vertical: (wd.cells[0].point[0] !== wd.cells[1].point[0])
		};
	    }));
	    in_commit = false;
	    mod_form_elt.innerHTML = '';
	}, word_cells, played_words);
    };
}
