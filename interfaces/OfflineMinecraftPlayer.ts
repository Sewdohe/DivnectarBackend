export default interface OfflineMinecraftPlayer {
  "uuid": string,
  "name": string,
  "whitelisted": boolean,
  "banned": boolean,
  "op": boolean,
  "balance": number,
  "lastPlayed": EpochTimeStamp
}