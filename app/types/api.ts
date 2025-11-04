/**
 * API Type Definitions for Stitcher Backend
 *
 * These types define the request/response contracts for the stitcher API endpoints.
 */

export interface Player {
  player_id: number;
  player_name?: string;
  player_number?: number;
  team_id?: number;
  tracker_ids: number[];
  image_path?: string;
}

export interface PlayerCreateRequest {
  player_name?: string;
  player_number?: number;
  team_id?: number;
  tracker_ids: number[];
  image_path?: string;
}

export interface PlayerUpdateRequest {
  player_id: number;
  player_name?: string;
  player_number?: number;
  team_id?: number;
  tracker_ids?: number[];
  image_path?: string;
}

export interface PlayersResponse {
  players: Player[];
}