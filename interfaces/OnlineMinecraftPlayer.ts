export default interface OnlineMinecraftPlayer {
  uuid: string;
  displayName: string;
  address: string;
  port: number;
  exaustion: number;
  exp: number;
  whitelisted: boolean;
  banned: boolean;
  op: boolean;
  balance: number;
  location: [number, number, number];
  dimension: string;
  health: number;
  hunger: number;
  saturation: number;
  gamemode: "survival" | "creative" | "spectator";
  lastPlayed: EpochTimeStamp;
}