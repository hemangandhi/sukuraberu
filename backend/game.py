from dataclasses import dataclass, field, asdict
from typing import Tuple, Dict, List, Optional
from enum import Enum
import random
from copy import deepcopy

def copy_to_array(tile, n):
    tiles = []
    for i in range(n):
        tiles.append(deepcopy(tile))
    return tiles


class BoardCell(Enum):
    DEFAULT = 0
    DOUBLE_LETTER = 1
    TRIPLE_LETTER = 2
    DOUBLE_WORD = 3
    TRIPLE_WORD = 4

    def score_letter(self):
        if self.value > 2:
            return 1
        return self.value + 1

    def score_word(self):
        if self.value < 3:
            return 1
        return self.value - 1

    def to_js_tuple(self):
        if self.value < 3:
            return [1, self.value + 1]
        return [self.value - 1, 1]


@dataclass(eq = True)
class Tile:
    face: str = field(compare=False) # Exclude from == for blank tile handling from the JS side.
    modifications: str
    score: int
    blank_tile_modification: Optional[str]

    def __post_init__(self):
        if self.face not in self.modifications:
            raise ValueError("Face must be one of the modifications")

@dataclass
class Word:
    characters: str
    tiles: List[Tile]
    first_character_point: Tuple[int, int]
    is_vertical: bool

    def __post_init__(self):
        if len(self.characters) < 2:
            raise ValueError("Word is too short")
        if (bad := [c for c, t in zip(self.characters, self.tiles) if c not in t.modifications]):
            raise ValueError("Characters with bad modifications: {}".format(bad))
        if len(self.characters) != len(self.tiles):
            raise ValueError("Mismatching number of tiles and characters")

    def __str__(self):
        return ''.join(self.characters)

    def to_dict(self):
        return asdict(self)


@dataclass
class Player:
    name: str
    hand: List[Tile] = field(default_factory=list)
    score: int = 0

    def to_dict(self):
        return asdict(self)


@dataclass
class Game:
    players: List[Player]
    board: List[List[Tile]]
    special_spots: Dict[Tuple[int, int], BoardCell]
    words: List[Word]
    bag_tiles: List[Tile]
    turn: int = 0
    hand_capacity: int = 7

    def __post_init__(self) -> str:
        if not self.players:
            raise ValueError("Expected nonzero number of players")
        self.turn %= len(self.players)
        if any(len(row) != len(self.board) for row in self.board):
            raise ValueError("Board in not square")
        if not all(0 <= key[0] < len(self.board) and 0 <= key[1] < len(self.board) for key in self.special_spots.keys()):
            raise ValueError("Special tile misplaced")

    
    @staticmethod
    def validate_turn(hand: List[Tile], word: Word, board: List[List[Tile]],
                      played_tiles: List[Tile]) -> Tuple[bool, str]:
        row, col = word.first_character_point
        vertical_offset = 0 if not word.is_vertical else len(word.tiles)
        horizontal_offset = 0 if word.is_vertical else len(word.tiles)
        if row < 0 or row + vertical_offset >= len(board):
            return False, "Invalid starting row for word " + str(word)
        if col < 0 or col + horizontal_offset >= len(board[0]):
            return False, "Invalid starting col for word " + str(word)
        for offset, tile in enumerate(word.tiles):
            board_tile = board[row + offset][col] if word.is_vertical else board[row][col + offset]
            if board_tile.face == ' ' and board_tile.blank_tile_modification is None:
                if tile not in hand:
                    return False, "Player does not have the tile to play {}".format(tile)
                played_tiles.append(tile)
            elif board_tile != tile:
                return False, "Tile {} not played on a corresponding blank slot".format(tile)
        return True, ''

    def play_turn(self, words: List[Word]):
        played_tiles = []

        for word in words:
            valid_p, err_msg = Game.validate_turn(self.players[self.turn].hand, word, self.board, played_tiles)
            row, col = word.first_character_point
            if not valid_p:
                raise ValueError(err_msg)
            self.words.append(word)

            score = 0
            multiplier = 1
            for tile in word.tiles:
                self.board[row][col] = tile
                cell = self.special_spots.get((row, col), BoardCell.DEFAULT)
                score += tile.score * cell.score_letter()
                multiplier *= cell.score_word()
                if word.is_vertical:
                    row += 1
                else:
                    col += 1
            score *= multiplier
            self.players[self.turn].score += score

        for word in words:
            srow, scol = word.first_character_point
            for offset, tile in enumerate(word.tiles):
                if word.is_vertical:
                    row, col = srow + offset, col
                else:
                    row, col = srow, col + offset
                cell = self.special_spots.get((row, col), BoardCell.DEFAULT)
                if cell != BoardCell.DEFAULT:
                    del self.special_spots[(row, col)]
                try:
                    idx = self.players[self.turn].hand.index(tile)
                    del self.players[self.turn].hand[idx]
                except ValueError:
                    continue
        self.deal_tiles(self.players[self.turn])
        self.turn += 1
        self.turn %= len(self.players)

    def deal_tiles(self, player: Player):
        random.shuffle(self.bag_tiles)
        n_draw = self.hand_capacity - len(player.hand)
        player.hand += self.bag_tiles[:n_draw]
        self.bag_tiles = self.bag_tiles[n_draw:]

    def to_dict(self):
        d = asdict(self)
        del d['bag_tiles']
        d['special_spots'] = [{'x': x, 'y': y, 'cell': self.special_spots[(x, y)].to_js_tuple()} for x, y in self.special_spots]
        return d

def make_default_scrabble(players: List[Player]):
    BOARD_SIZE = 15
    def extend_over_quandrants(spots):
        # appending to a dict while iterating is an error
        spots_c = dict()
        for q in range(0, 4):
            for x, y in spots:
                r = BOARD_SIZE - 1 - x if q % 2 != 0 else x
                c = BOARD_SIZE - 1 - y if q >= 2 else y
                spots_c[(r, c)] = spots[(x, y)]
        return spots_c

    SPECIAL_SPOTS = extend_over_quandrants({
        (0, 0): BoardCell.TRIPLE_WORD,
        (0, 3): BoardCell.DOUBLE_LETTER,
        (0, 7): BoardCell.TRIPLE_WORD,
        (1, 1): BoardCell.DOUBLE_WORD,
        (1, 5): BoardCell.TRIPLE_LETTER,
        (2, 2): BoardCell.DOUBLE_WORD,
        (2, 6): BoardCell.DOUBLE_LETTER,
        (3, 0): BoardCell.DOUBLE_LETTER,
        (3, 3): BoardCell.DOUBLE_WORD,
        (3, 7): BoardCell.DOUBLE_LETTER,
        (4, 4): BoardCell.DOUBLE_WORD,
        (5, 1): BoardCell.TRIPLE_LETTER,
        (5, 5): BoardCell.TRIPLE_LETTER,
        (6, 2): BoardCell.DOUBLE_LETTER,
        (6, 6): BoardCell.DOUBLE_LETTER,
        (7, 0): BoardCell.TRIPLE_WORD,
        (7, 3): BoardCell.DOUBLE_LETTER,
        (7, 7): BoardCell.DOUBLE_WORD
    })

    def tiles_of_score_dict(score_dict, nblanks):
        blank_tile_mods = ''
        total_tiles = []
        for score in score_dict:
            for nrepeat in score_dict[score]:
                for mod_str in score_dict[score][nrepeat]:
                    total_tiles += copy_to_array(Tile(mod_str[0], mod_str, score, None), nrepeat)
                    blank_tile_mods += mod_str
        blank_tile_mods = ''.join(set(blank_tile_mods))
        return total_tiles + copy_to_array(Tile('', blank_tile_mods, 0, None), nblanks)
    
    TILES = tiles_of_score_dict({
        1: {4: ['いーぃ', 'うーぅ', 'かが', 'しじ', 'ただ', 'てで', 'とど', 'の', 'ん']},
        2: {3: ['きぎ', 'くぐ', 'こご', 'つづっ', 'な', 'に', 'はばぱ', 'よょ', 'れ']},
        3: {2: ['あーぁ', 'けげ', 'すず', 'せぜ', 'も', 'り', 'る', 'わゎ'], 1: ['ら']},
        4: {1: ['さざ', 'そぞ', 'ちぢ', 'ま']},
        5: {1: ['おーぉ', 'ひびぴ', 'ふぶぷ', 'ゆゅ']},
        6: {1: ['ほぼぽ', 'め', 'やゃ']},
        8: {1: ['えーぇ', 'へべぺ', 'み']},
        10: {1: ['ね', 'む', 'ろ']},
        12: {1: ['ぬ']}
    }, 2)

    # Note: the blank tile for the game is Tile('', ALL_OF_HIRAGANA, 0, None).
    g = Game(players, [[Tile(' ', ' ', 0, None) for i in range(BOARD_SIZE)] for j in range(BOARD_SIZE)], SPECIAL_SPOTS, [], TILES)
    for p in players:
        g.deal_tiles(p)
    return g
