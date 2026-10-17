import Phaser from 'phaser';

export const GAME_W = 1600;
export const GAME_H = 900;

export function createGame(scenes: Phaser.Types.Scenes.SceneType[]): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'phaser-root',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#0a1228',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 3 },
    render: { antialias: true },
    scene: scenes,
  });
}
