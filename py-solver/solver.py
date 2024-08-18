BLANK = '⬜️'
FILLED = '⬛️'
EMPTY = '🟧'


class Segment:
  def __init__(self, n) -> None:
    self.number = n
    self.completed = False
  number: int
  completed: bool

class Space:
  def __init__(self) -> None:
    self.status = BLANK
  status: str
  x_segment: tuple # row index, segment index
  y_segment: tuple


def print_rows(numbers):
  n = len(numbers) / 2
  print("Columns:")
  for i in range(len(numbers)):
    row = ''
    for j in range(len(numbers[i])):
      if numbers[i][j].completed: row += '~'
      row += str(numbers[i][j].number)
      if j < len(numbers[i]) - 1: row += ', '
    print(row)
    if i == n - 1: print("\nRows:")

def print_board(board):
  print("")
  for i in range(len(board)):
    row = ''
    for j in range(len(board[0])):
      row += board[i][j].status
    print(row)

def create_board(filename: str):
  file = open(filename)
  board_size = int(file.readline())
  print(board_size)

  numbers = []
  for i in range(2 * board_size):
    content = file.readline()
    nums = [Segment(int(x)) for x in content.split(',')]
    if nums[0].number != 0:
      numbers.append(nums)
  file.close()

  board = []

  for i in range(board_size):
    row = []
    for j in range(board_size):
      space = Space()
      row.append(space)
    board.append(row)

  print_rows(numbers)
  print_board(board)

  return board, numbers

def initial_solver_setup(board, numbers):
  """Given numbers, does first iteration of board sweep"""
  n = len(board)
  filled_lines = set()

  # Iterate through each line, first columns. Then rows.
  for line_index in range(len(numbers)):
    line = numbers[line_index]
    horizontal = line_index >= n
    longest_segment_in_line = 0
    count = max(0, len(line) - 1)
    # Iterate through each number segment of each line
    for segment in line:
      count += segment.number
      longest_segment_in_line = max(segment.number, longest_segment_in_line)
    
    if count == n:
      # Fill in the entire row/column
      filled_lines.add(line_index)
      spot_index = 0
      for segment_index in range(len(line)):
        for j in range(line[segment_index].number):
          if horizontal:
            board[line_index % n][spot_index].status = FILLED
            board[line_index % n][spot_index].y_segment = (line_index, segment_index)
          else:
            board[spot_index][line_index].status = FILLED
            board[spot_index][line_index].x_segment = (line_index, segment_index)
          j += 1
          spot_index += 1
        line[segment_index].completed = True
        if spot_index < n:
          if horizontal:
            board[line_index % n][spot_index].status = EMPTY
          else:
            board[spot_index][line_index].status = EMPTY
          spot_index += 1
    elif n - count < longest_segment_in_line:
      # Fill in some of the row/column
      spot_index = 0
      for segment_index in range(len(line)):
        if line[segment_index].number <= n - count:
          spot_index += line[segment_index].number
          continue
        # skip n - count indices, then
        spot_index += (n - count)
        # fill in for remaining parts of segment
        for j in range(n - count, line[segment_index].number):
          if horizontal:
            board[line_index % n][spot_index].status = FILLED
            board[line_index % n][spot_index].y_segment = (line_index, segment_index)
          else:
            board[spot_index][line_index].status = FILLED
            board[spot_index][line_index].x_segment = (line_index, segment_index)
          j += 1
          spot_index += 1


def solve_game(board, numbers):
  """Main solver method"""
  initial_solver_setup(board, numbers)
  print_board(board)

def main():
  # create board
  inputfile = "test2.txt"
  board, numbers = create_board(inputfile)
  # print(numbers)

  solve_game(board, numbers)
  # not_finished = True

  # solve game. 
  # while not_finished:
  #   for i in range(N):
  #     for j in range(N):
  #       print("asdf")


if __name__ == "__main__":
  main()
