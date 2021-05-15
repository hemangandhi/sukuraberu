from dataclasses import dataclass
from typing import Tuple, Dict, List, Optional
from enum import Enum

# Literally because I want the __init__ from dataclass but also a few
# invariants. (And I can.)
def with_post_init_invariant(inv, err_template = "{}"):
    def wrapper(cls):
        def wrapped_init(self, *args, **kwargs):
            cls.__init__(self, *args, **kwargs)
            if (failures := inv(self)):
                raise ValueError(err_template.format(failures))
        # I am the walrus, Goo goo g'joob
        (wrapped_dict := dict(cls.__dict__))['__init__'] = wrapped_init
        return type('Wrapping' + cls.__name__, cls.__bases__, wrapped_dict)
    return wrapper

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


@dataclass(eq = True)
class Tile:
    face: str
    modifications: str
    score: int
    blank_tile_modification: Optional[str]

@with_post_init_invariant(
    (lambda wd: [c for c, t in zip(wd.characters, wd.tiles) if c not in t.modifications]\
                 or len(wd.characters) != len(wd.tiles) or len(wd.characters) < 2),
     "Invalid characters (or 'True' if the word is too short): {}")
@dataclass
class Word:
    characters: str
    tiles: List[Tile]
    first_character_point: Tuple[int, int]
    is_vertical: bool

    def __str__(self):
        return ''.join(self.characters)


@dataclass
class Player:
    name: str
    hand: List[Tile]
    score: int = 0


def game_init_invariant(game) -> str:
    if not game.players:
        return "Expected nonzero number of players"
    game.turn %= len(game.players)
    if any(len(row) != len(game.board) for row in game.board):
        return "Board in not square"
    if not all(0 <= key[0] < len(game.board) and 0 <= key[1] < len(game.board) for key in game.special_spots.keys()):
        return "Special tile misplaced"
    return ""


@with_post_init_invariant(game_init_invariant)
@dataclass
class Game:
    players: List[Player]
    board: List[List[Tile]]
    special_spots: Dict[Tuple[int, int], BoardCell]
    words: List[Word]
    bag_tiles: List[Tile]
    turn: int = 0

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
            if board_tile != tile:
                return False, "Tile {} not played on a corresponding blank slot".format(tile)
        return True, ''

    def play_turn(self, word: Word):
        played_tiles = []
        valid_p, err_msg = Game.validate_turn(self.players[self.turn].hand, word, self.board, played_tiles)
        if not valid_p:
            raise ValueError(err_msg)
        self.words.append(word)

        score = 0
        multiplier = 1
        for tile in word.tiles:
            board[row][col] = tile
            if word.is_vertical:
                row += 1
            else:
                col += 1
            cell = special_spots.get((row, col), BoardCell.DEFAULT)
            score += tile.score * cell.score_letter()
            multiplier *= cell.score_word()
            if cell != BoardCell.DEFAULT:
                del special_spots[(row, col)]
        score *= multiplier
        self.players[self.turn].score += score

        for tile in word.tiles:
            try:
                idx = self.players[self.turn].hand.index(tile)
                del self.players[self.turn].hand[idx]
            except ValueError:
                continue
        self.turn += 1
        self.turn %= len(self.players)
