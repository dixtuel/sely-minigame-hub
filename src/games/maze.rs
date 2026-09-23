//! Grid-based maze generation (Recursive Backtracker + Braiding + Gate Bottleneck)
//! Matches client/src/game/maze.ts and maze.test.ts.

use std::collections::{HashMap, HashSet, VecDeque};
use std::f64::consts::PI;

pub const MAZE_COLS: usize = 13;
pub const MAZE_ROWS: usize = 11;
pub const MAZE_CELL_SIZE: f64 = 2.3;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct CellCoord {
    pub col: usize,
    pub row: usize,
}

#[derive(Clone, Debug)]
pub struct MazeCell {
    pub col: usize,
    pub row: usize,
    pub north: bool,
    pub south: bool,
    pub east: bool,
    pub west: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MazeWall {
    pub x1: f64,
    pub z1: f64,
    pub x2: f64,
    pub z2: f64,
    pub cell_a: CellCoord,
    pub cell_b: CellCoord,
}

#[derive(Clone, Debug)]
pub struct MazeRoom {
    pub col: usize,
    pub row: usize,
    pub size: usize,
    pub cx: f64,
    pub cz: f64,
    pub theme: usize,
}

#[derive(Clone, Debug)]
pub struct MazeResult {
    pub cols: usize,
    pub rows: usize,
    pub cell_size: f64,
    pub origin_x: f64,
    pub origin_z: f64,
    pub cells: Vec<Vec<MazeCell>>,
    pub walls: Vec<MazeWall>,
    pub gate_wall: MazeWall,
    pub gate_cell: CellCoord,
    pub start_cell: CellCoord,
    pub marker_cells: Vec<CellCoord>,
    pub rooms: Vec<MazeRoom>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Dir {
    North,
    South,
    East,
    West,
}

impl Dir {
    fn opposite(self) -> Self {
        match self {
            Dir::North => Dir::South,
            Dir::South => Dir::North,
            Dir::East => Dir::West,
            Dir::West => Dir::East,
        }
    }
}

pub fn cell_center(origin_x: f64, origin_z: f64, cell_size: f64, col: usize, row: usize) -> (f64, f64) {
    (
        origin_x + (col as f64) * cell_size + cell_size / 2.0,
        origin_z + (row as f64) * cell_size + cell_size / 2.0,
    )
}

pub fn generate_maze<F>(mut rng: F, mastery: i32) -> MazeResult
where
    F: FnMut() -> f64,
{
    let cols = MAZE_COLS;
    let rows = MAZE_ROWS;
    let cell_size = MAZE_CELL_SIZE;
    let origin_x = -((cols as f64) * cell_size) / 2.0;
    let origin_z = -((rows as f64) * cell_size) / 2.0;

    let mut cells: Vec<Vec<MazeCell>> = (0..rows)
        .map(|r| {
            (0..cols)
                .map(|c| MazeCell {
                    col: c,
                    row: r,
                    north: true,
                    south: true,
                    east: true,
                    west: true,
                })
                .collect()
        })
        .collect();

    let mut visited = vec![vec![false; cols]; rows];
    let mut parent_edge = HashMap::<String, MazeWall>::new();

    let key = |c: usize, r: usize| format!("{c},{r}");

    let neighbors_of = |c: usize, r: usize| {
        let mut list = Vec::with_capacity(4);
        if r > 0 {
            list.push((c, r - 1, Dir::North));
        }
        if r < rows - 1 {
            list.push((c, r + 1, Dir::South));
        }
        if c > 0 {
            list.push((c - 1, r, Dir::West));
        }
        if c < cols - 1 {
            list.push((c + 1, r, Dir::East));
        }
        list
    };

    let wall_segment_for = |c: usize, r: usize, dir: Dir| -> MazeWall {
        let x0 = origin_x + (c as f64) * cell_size;
        let z0 = origin_z + (r as f64) * cell_size;
        let cell_a = CellCoord { col: c, row: r };
        match dir {
            Dir::North => MazeWall {
                x1: x0,
                z1: z0,
                x2: x0 + cell_size,
                z2: z0,
                cell_a,
                cell_b: CellCoord { col: c, row: r - 1 },
            },
            Dir::South => MazeWall {
                x1: x0,
                z1: z0 + cell_size,
                x2: x0 + cell_size,
                z2: z0 + cell_size,
                cell_a,
                cell_b: CellCoord { col: c, row: r + 1 },
            },
            Dir::West => MazeWall {
                x1: x0,
                z1: z0,
                x2: x0,
                z2: z0 + cell_size,
                cell_a,
                cell_b: CellCoord { col: c - 1, row: r },
            },
            Dir::East => MazeWall {
                x1: x0 + cell_size,
                z1: z0,
                x2: x0 + cell_size,
                z2: z0 + cell_size,
                cell_a,
                cell_b: CellCoord { col: c + 1, row: r },
            },
        }
    };

    let start_col = 1 + (rng() * 2.0).floor() as usize;
    let start_row = 1 + (rng() * 2.0).floor() as usize;
    let mut stack = vec![(start_col, start_row)];
    visited[start_row][start_col] = true;

    while let Some(&(c, r)) = stack.last() {
        let options: Vec<(usize, usize, Dir)> = neighbors_of(c, r)
            .into_iter()
            .filter(|&(nc, nr, _)| !visited[nr][nc])
            .collect();

        if options.is_empty() {
            stack.pop();
            continue;
        }

        let idx = (rng() * (options.len() as f64)).floor() as usize;
        let (nc, nr, dir) = options[idx];

        match dir {
            Dir::North => cells[r][c].north = false,
            Dir::South => cells[r][c].south = false,
            Dir::East => cells[r][c].east = false,
            Dir::West => cells[r][c].west = false,
        }
        match dir.opposite() {
            Dir::North => cells[nr][nc].north = false,
            Dir::South => cells[nr][nc].south = false,
            Dir::East => cells[nr][nc].east = false,
            Dir::West => cells[nr][nc].west = false,
        }

        parent_edge.insert(key(nc, nr), wall_segment_for(c, r, dir));
        visited[nr][nc] = true;
        stack.push((nc, nr));
    }

    // BFS distance calculation
    let mut dist = vec![vec![-1i32; cols]; rows];
    dist[start_row][start_col] = 0;
    let mut frontier = vec![(start_col, start_row)];

    while !frontier.is_empty() {
        let mut next = Vec::new();
        for (c, r) in frontier {
            let cell = &cells[r][c];
            let mut open = Vec::with_capacity(4);
            if !cell.north {
                open.push((c, r - 1));
            }
            if !cell.south {
                open.push((c, r + 1));
            }
            if !cell.east {
                open.push((c + 1, r));
            }
            if !cell.west {
                open.push((c - 1, r));
            }
            for (nc, nr) in open {
                if dist[nr][nc] == -1 {
                    dist[nr][nc] = dist[r][c] + 1;
                    next.push((nc, nr));
                }
            }
        }
        frontier = next;
    }

    // Farthest cell becomes gateCell
    let mut gate_cell = CellCoord {
        col: start_col,
        row: start_row,
    };
    let mut best_dist = -1;
    for r in 0..rows {
        for c in 0..cols {
            if dist[r][c] > best_dist {
                best_dist = dist[r][c];
                gate_cell = CellCoord { col: c, row: r };
            }
        }
    }
    let gate_wall = parent_edge.get(&key(gate_cell.col, gate_cell.row)).unwrap().clone();

    // Markers: 3 distinct sectors
    struct Candidate {
        col: usize,
        row: usize,
        d: i32,
    }
    let mut reachable = Vec::new();
    for r in 0..rows {
        for c in 0..cols {
            if c == gate_cell.col && r == gate_cell.row {
                continue;
            }
            if c == start_col && r == start_row {
                continue;
            }
            if (c as isize - start_col as isize).abs() + (r as isize - start_row as isize).abs() <= 1 {
                continue;
            }
            if (c as isize - gate_cell.col as isize).abs() + (r as isize - gate_cell.row as isize).abs() <= 1 {
                continue;
            }
            if dist[r][c] >= 2 {
                reachable.push(Candidate {
                    col: c,
                    row: r,
                    d: dist[r][c],
                });
            }
        }
    }

    let mid_c = (cols as f64) / 2.0;
    let mid_r = (rows as f64) / 2.0;
    let sector_of = |c: usize, r: usize| -> usize {
        let angle = ((r as f64) - mid_r).atan2((c as f64) - mid_c);
        if angle < -PI / 3.0 {
            0
        } else if angle < PI / 3.0 {
            1
        } else {
            2
        }
    };

    let mut sectors: [Vec<Candidate>; 3] = [Vec::new(), Vec::new(), Vec::new()];
    for cand in reachable {
        sectors[sector_of(cand.col, cand.row)].push(cand);
    }
    for sec in &mut sectors {
        sec.sort_by(|a, b| b.d.cmp(&a.d));
    }

    let mut marker_cells = Vec::<CellCoord>::with_capacity(3);
    let min_sep = 4.0;

    for s in 0..3 {
        let candidates = &sectors[s];
        let picked = candidates
            .iter()
            .find(|cand| {
                marker_cells.iter().all(|m| {
                    let dc = (m.col as f64) - (cand.col as f64);
                    let dr = (m.row as f64) - (cand.row as f64);
                    (dc * dc + dr * dr).sqrt() >= min_sep
                })
            })
            .or_else(|| candidates.first());

        if let Some(p) = picked {
            if !marker_cells.iter().any(|m| m.col == p.col && m.row == p.row) {
                marker_cells.push(CellCoord {
                    col: p.col,
                    row: p.row,
                });
            }
        }
    }

    // Braiding
    let braid_chance = (0.16 + (mastery as f64) * 0.09).clamp(0.12, 0.55);
    for r in 0..rows {
        for c in 0..cols {
            if c == gate_cell.col && r == gate_cell.row {
                continue;
            }
            let cell = &cells[r][c];
            let open_count = [cell.north, cell.south, cell.east, cell.west]
                .iter()
                .filter(|&&w| !w)
                .count();
            if open_count != 1 || rng() > braid_chance {
                continue;
            }
            let closed_dirs: Vec<Dir> = [Dir::North, Dir::South, Dir::East, Dir::West]
                .iter()
                .cloned()
                .filter(|&d| match d {
                    Dir::North => cells[r][c].north,
                    Dir::South => cells[r][c].south,
                    Dir::East => cells[r][c].east,
                    Dir::West => cells[r][c].west,
                })
                .collect();

            for dir in closed_dirs {
                let (dc, dr): (isize, isize) = match dir {
                    Dir::North => (0, -1),
                    Dir::South => (0, 1),
                    Dir::East => (1, 0),
                    Dir::West => (-1, 0),
                };
                let nc = c as isize + dc;
                let nr = r as isize + dr;
                if nc < 0 || nc >= cols as isize || nr < 0 || nr >= rows as isize {
                    continue;
                }
                let nc = nc as usize;
                let nr = nr as usize;
                if nc == gate_cell.col && nr == gate_cell.row {
                    continue;
                }
                if rng() < 0.6 {
                    match dir {
                        Dir::North => cells[r][c].north = false,
                        Dir::South => cells[r][c].south = false,
                        Dir::East => cells[r][c].east = false,
                        Dir::West => cells[r][c].west = false,
                    }
                    match dir.opposite() {
                        Dir::North => cells[nr][nc].north = false,
                        Dir::South => cells[nr][nc].south = false,
                        Dir::East => cells[nr][nc].east = false,
                        Dir::West => cells[nr][nc].west = false,
                    }
                    break;
                }
            }
        }
    }

    // Theme rooms
    let theme_anchors: [(usize, usize); 4] = [
        (((cols as f64) * 0.25).floor() as usize, ((rows as f64) * 0.25).floor() as usize),
        (((cols as f64) * 0.75).floor() as usize, ((rows as f64) * 0.25).floor() as usize),
        (((cols as f64) * 0.75).floor() as usize, ((rows as f64) * 0.75).floor() as usize),
        (((cols as f64) * 0.25).floor() as usize, ((rows as f64) * 0.75).floor() as usize),
    ];
    let mut rooms = Vec::with_capacity(4);

    for (theme, &(ac, ar)) in theme_anchors.iter().enumerate() {
        let c0 = ac.clamp(0, cols - 2);
        let r0 = ar.clamp(0, rows - 2);
        let block = [(c0, r0), (c0 + 1, r0), (c0, r0 + 1), (c0 + 1, r0 + 1)];
        let is_locked = block.iter().any(|&(c, r)| c == gate_cell.col && r == gate_cell.row);

        if !is_locked {
            cells[r0][c0].east = false;
            cells[r0][c0 + 1].west = false;
            cells[r0 + 1][c0].east = false;
            cells[r0 + 1][c0 + 1].west = false;
            cells[r0][c0].south = false;
            cells[r0 + 1][c0].north = false;
            cells[r0][c0 + 1].south = false;
            cells[r0 + 1][c0 + 1].north = false;
        }
        let (cx, cz) = cell_center(origin_x, origin_z, cell_size, c0 + 1, r0 + 1);
        rooms.push(MazeRoom {
            col: c0,
            row: r0,
            size: 2,
            cx,
            cz,
            theme,
        });
    }

    // Walls
    let mut walls = Vec::new();
    let gate_key = format!("{},{},{},{}", gate_wall.x1, gate_wall.z1, gate_wall.x2, gate_wall.z2);
    let mut seen = HashSet::new();

    for r in 0..rows {
        for c in 0..cols {
            let cell = &cells[r][c];
            if cell.north && r > 0 {
                let seg = wall_segment_for(c, r, Dir::North);
                let k = format!("{},{},{},{}", seg.x1, seg.z1, seg.x2, seg.z2);
                if !seen.contains(&k) && k != gate_key {
                    seen.insert(k);
                    walls.push(seg);
                }
            }
            if cell.west && c > 0 {
                let seg = wall_segment_for(c, r, Dir::West);
                let k = format!("{},{},{},{}", seg.x1, seg.z1, seg.x2, seg.z2);
                if !seen.contains(&k) && k != gate_key {
                    seen.insert(k);
                    walls.push(seg);
                }
            }
        }
    }

    MazeResult {
        cols,
        rows,
        cell_size,
        origin_x,
        origin_z,
        cells,
        walls,
        gate_wall,
        gate_cell,
        start_cell: CellCoord {
            col: start_col,
            row: start_row,
        },
        marker_cells,
        rooms,
    }
}

/// BFS shortest corridor pathfinding between two maze cells
pub fn find_maze_path(
    cells: &[Vec<MazeCell>],
    cols: usize,
    rows: usize,
    start: CellCoord,
    target: CellCoord,
) -> Option<Vec<CellCoord>> {
    if start == target {
        return Some(vec![start]);
    }

    let mut parent = HashMap::<CellCoord, Option<CellCoord>>::new();
    parent.insert(start.clone(), None);

    let mut queue = VecDeque::new();
    queue.push_back(start);

    while let Some(current) = queue.pop_front() {
        if current == target {
            break;
        }

        let cell = &cells[current.row][current.col];
        let mut neighbors = Vec::with_capacity(4);

        if !cell.north && current.row > 0 {
            neighbors.push(CellCoord { col: current.col, row: current.row - 1 });
        }
        if !cell.south && current.row < rows - 1 {
            neighbors.push(CellCoord { col: current.col, row: current.row + 1 });
        }
        if !cell.east && current.col < cols - 1 {
            neighbors.push(CellCoord { col: current.col + 1, row: current.row });
        }
        if !cell.west && current.col > 0 {
            neighbors.push(CellCoord { col: current.col - 1, row: current.row });
        }

        for n in neighbors {
            if !parent.contains_key(&n) {
                parent.insert(n.clone(), Some(current.clone()));
                queue.push_back(n);
            }
        }
    }

    if !parent.contains_key(&target) {
        return None;
    }

    let mut path = Vec::new();
    let mut curr = Some(target);
    while let Some(c) = curr {
        path.push(c.clone());
        curr = parent.get(&c).and_then(|opt| opt.clone());
    }

    path.reverse();
    Some(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::games::rng::Mulberry32;

    #[test]
    fn test_guarantees_maze_solvability_and_markers() {
        for seed in 1..=10 {
            let mut rng = Mulberry32::new((seed * 991) as u32);
            let maze = generate_maze(|| rng.next_f64(), 1);

            // Connectivity test
            let mut visited = vec![vec![false; maze.cols]; maze.rows];
            let mut stack = vec![(maze.start_cell.col, maze.start_cell.row)];
            visited[maze.start_cell.row][maze.start_cell.col] = true;
            let mut count = 1;

            while let Some((c, r)) = stack.pop() {
                let cell = &maze.cells[r][c];
                let mut neighbors = Vec::new();
                if !cell.north { neighbors.push((c, r - 1)); }
                if !cell.south { neighbors.push((c, r + 1)); }
                if !cell.east { neighbors.push((c + 1, r)); }
                if !cell.west { neighbors.push((c - 1, r)); }

                for (nc, nr) in neighbors {
                    if !visited[nr][nc] {
                        visited[nr][nc] = true;
                        count += 1;
                        stack.push((nc, nr));
                    }
                }
            }
            assert_eq!(count, maze.cols * maze.rows);
            assert_eq!(maze.rooms.len(), 4);
            assert!(maze.marker_cells.len() <= 3);

            let path = find_maze_path(
                &maze.cells,
                maze.cols,
                maze.rows,
                maze.start_cell.clone(),
                maze.marker_cells[0].clone(),
            );
            assert!(path.is_some());
            let p = path.unwrap();
            assert_eq!(p.first().unwrap(), &maze.start_cell);
            assert_eq!(p.last().unwrap(), &maze.marker_cells[0]);
        }
    }
}
