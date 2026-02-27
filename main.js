/**
 * Configuracoes principais do jogo.
 */
const GAME = {
  width: 1024,
  height: 1536
};

/**
 * Areas clicaveis dos botoes desenhados nas imagens.
 * Coordenadas baseadas na resolucao 1024x1536.
 */
const BUTTON_AREAS = {
  start: { x: 274, y: 920, width: 474, height: 130 },
  restart: { x: 250, y: 770, width: 250, height: 86 },
  menu: { x: 524, y: 770, width: 250, height: 86 }
};

/**
 * Controla os botoes HTML transparentes.
 * Eles ficam atras do canvas e capturam cliques nas areas corretas.
 */
const buttonOverlay = {
  canvas: null,
  buttons: {},
  activeButtons: [],
  resizeAttached: false,

  init(scene) {
    this.canvas = scene.sys.game.canvas;
    this.canvas.style.position = "CENTER";
    this.canvas.style.left = "50%";
    this.canvas.style.top = "50%";
    this.canvas.style.transform = "translate(-50%, -50%)";
    this.canvas.style.zIndex = "2";

    if (!this.buttons.start) {
      this.buttons.start = document.getElementById("start-btn");
      this.buttons.restart = document.getElementById("restart-btn");
      this.buttons.menu = document.getElementById("menu-btn");
    }

    if (!this.resizeAttached) {
      window.addEventListener("resize", () => this.refreshPositions());
      this.resizeAttached = true;
    }
  },

  hideAll() {
    this.activeButtons = [];

    Object.values(this.buttons).forEach((button) => {
      if (!button) {
        return;
      }

      button.style.display = "none";
      button.onclick = null;
    });

    if (this.canvas) {
      this.canvas.style.pointerEvents = "auto";
    }
  },

  showButton(name, onClick) {
    const button = this.buttons[name];
    if (!button) {
      return;
    }

    button.style.display = "block";
    button.onclick = onClick;
    this.activeButtons.push(name);
    this.positionButton(name);
  },

  positionButton(name) {
    const button = this.buttons[name];
    const area = BUTTON_AREAS[name];
    if (!button || !area || !this.canvas) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME.width;
    const scaleY = rect.height / GAME.height;

    button.style.left = `${rect.left + area.x * scaleX}px`;
    button.style.top = `${rect.top + area.y * scaleY}px`;
    button.style.width = `${area.width * scaleX}px`;
    button.style.height = `${area.height * scaleY}px`;
  },

  refreshPositions() {
    for (let i = 0; i < this.activeButtons.length; i++) {
      this.positionButton(this.activeButtons[i]);
    }
  },

  showStart(onStart) {
    this.hideAll();
    this.canvas.style.pointerEvents = "none";
    this.showButton("start", onStart);
  },

  showGameOver(onRestart, onMenu) {
    this.hideAll();
    this.canvas.style.pointerEvents = "none";
    this.showButton("restart", onRestart);
    this.showButton("menu", onMenu);
  }
};

/**
 * Cena 1: carrega assets e cria animacoes.
 */
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.image("start_bg", "assets/start_bg.png");
    this.load.image("game_over", "assets/game_over.png");
    this.load.image("bg_far", "assets/bg_far.png");
    this.load.image("bg_mid", "assets/bg_mid.png");
    this.load.image("pipe", "assets/pipe.png");

    this.load.spritesheet("fish", "assets/fish_sheet.png", {
      frameWidth: 32,
      frameHeight: 32
    });

    this.load.spritesheet("coin", "assets/coin.png", {
      frameWidth: 136,
      frameHeight: 177
    });
  }

  create() {
    if (!this.anims.exists("fish_swim")) {
      this.anims.create({
        key: "fish_swim",
        frames: this.anims.generateFrameNumbers("fish", { start: 0, end: 6 }),
        frameRate: 12,
        repeat: -1
      });
    }

    if (!this.anims.exists("coin_spin")) {
      this.anims.create({
        key: "coin_spin",
        frames: this.anims.generateFrameNumbers("coin", { start: 0, end: 5 }),
        frameRate: 14,
        repeat: -1
      });
    }

    this.scene.start("StartScene");
  }
}

/**
 * Cena 2: tela inicial.
 */
class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: "StartScene" });
  }

  create() {
    this.add
      .image(GAME.width / 2, GAME.height / 2, "start_bg")
      .setDisplaySize(GAME.width, GAME.height);

    buttonOverlay.init(this);
    buttonOverlay.showStart(() => this.scene.start("PlayScene"));

    // Atalho para iniciar com teclado.
    this.input.keyboard.once("keydown-SPACE", () => this.scene.start("PlayScene"));
  }
}

function setupPipeHitbox(pipe, isTop) {
  const shrinkX = 0.58;
  const shrinkY = 0.90;

  // Usa tamanho base do sprite, sem escala
  const w = pipe.width;
  const h = pipe.height;

  const bw = Math.floor(w * shrinkX);
  const bh = Math.floor(h * shrinkY);

  pipe.body.setAllowGravity(false);
  pipe.body.setImmovable(true);

  // true centraliza automaticamente o body no sprite
  pipe.body.setSize(bw, bh, true);

  // Ajuste fino por causa do origin diferente
  // Offset aqui também é em pixels do sprite original
  const extraY = isTop ? -10 : 10;
  pipe.body.setOffset(pipe.body.offset.x, pipe.body.offset.y + extraY);

}

/**
 * Cena 3: gameplay principal.
 */
class PlayScene extends Phaser.Scene {
  constructor() {
    super({ key: "PlayScene" });
  }

  create() {
    buttonOverlay.init(this);
    buttonOverlay.hideAll();

    // Fundo com efeito parallax.
    this.bgFar = this.add
      .tileSprite(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, "bg_far")
      .setTint(0xa0d8ff);

    this.bgMid = this.add.tileSprite(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      "bg_mid"
    );

    // Chao invisivel para colisao.
    this.ground = this.add.rectangle(GAME.width / 2, GAME.height - 16, GAME.width, 32, 0x000000, 0);
    this.physics.add.existing(this.ground, true);

    // Jogador (peixe).
    this.fish = this.physics.add.sprite(245, GAME.height / 2, "fish");
    this.fish.setScale(3.3);
    this.fish.play("fish_swim");
    this.fish.setCollideWorldBounds(true);
    this.fish.body.setGravityY(1700);
    this.fish.body.setMaxVelocity(1000, 1200);

    // Grupos.
    this.pipes = this.physics.add.group();
    this.coins = this.physics.add.group();

    // Estado do jogo.
    this.isGameOver = false;
    this.distance = 0;
    this.coinCount = 0;
    this.elapsedSeconds = 0;

    // Dificuldade (valores iniciais e limites).
    this.speedStart = 390;
    this.speedMax = 680;
    this.gapStart = 470;
    this.gapMin = 310;
    this.spawnStart = 1650;
    this.spawnMin = 1100;

    this.pipeSpeed = this.speedStart;
    this.pipeGap = this.gapStart;
    this.spawnDelay = this.spawnStart;
    this.pipeScale = 0.25;

    // HUD.
    this.distanceText = this.add
      .text(28, 24, "Distancia: 0", {
        fontFamily: "Arial",
        fontSize: "44px",
        color: "#ffffff",
        stroke: "#0a2a4c",
        strokeThickness: 8
      })
      .setDepth(20);

    this.coinText = this.add
      .text(28, 86, "Moedas: 0", {
        fontFamily: "Arial",
        fontSize: "44px",
        color: "#ffe26b",
        stroke: "#5c3d00",
        strokeThickness: 8
      })
      .setDepth(20);

    // Controles.
    this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on("pointerdown", this.flap, this);
    this.upKey.on("down", this.flap, this);
    this.spaceKey.on("down", this.flap, this);

    // Colisoes e overlap.
    this.physics.add.collider(this.fish, this.ground, this.endGame, null, this);
    this.physics.add.collider(this.fish, this.pipes, this.endGame, null, this);
    this.physics.add.overlap(this.fish, this.coins, this.collectCoin, null, this);

    this.resetSpawnTimer();
    this.spawnPipePair();

    
  }

  /**
   * Reinicia o timer de spawn.
   */
  resetSpawnTimer() {
    if (this.spawnTimer) {
      this.spawnTimer.remove(false);
    }

    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      callback: this.spawnPipePair,
      callbackScope: this,
      loop: true
    });
  }

  /**
   * Faz o peixe subir.
   */
  flap() {
    if (this.isGameOver) {
      return;
    }

    this.fish.setVelocityY(-600);
  }

  /**
   * Cria um par de pipes com uma moeda no meio do gap.
   */
  spawnPipePair() {
    if (this.isGameOver) {
      return;
    }

    const halfGap = this.pipeGap / 2;
    const minCenterY = 250 + halfGap;
    const maxCenterY = GAME.height - 290 - halfGap;
    const centerY = Phaser.Math.Between(minCenterY, maxCenterY);
    const spawnX = GAME.width + 190;

    const topPipe = this.pipes.create(spawnX, centerY - halfGap, "pipe");
    topPipe.setScale(this.pipeScale);
    topPipe.setOrigin(0.5, 1);
    topPipe.setFlipY(true);
    topPipe.body.setVelocityX(-this.pipeSpeed);

    setupPipeHitbox(topPipe, true);

    const bottomPipe = this.pipes.create(spawnX, centerY + halfGap, "pipe");
  bottomPipe.setScale(this.pipeScale);
  bottomPipe.setOrigin(0.5, 0);
  bottomPipe.body.setVelocityX(-this.pipeSpeed);

setupPipeHitbox(bottomPipe, false);

    const coinY = Phaser.Math.Between(centerY - halfGap + 80, centerY + halfGap - 80);
    const coin = this.coins.create(spawnX + 8, coinY, "coin");
    coin.setScale(0.55);
    coin.play("coin_spin");
    coin.body.setAllowGravity(false);
    coin.body.setImmovable(true);
    coin.body.setVelocityX(-this.pipeSpeed);
  }

  /**
   * Coleta uma moeda.
   */
  collectCoin(_fish, coin) {
    coin.destroy();
    this.coinCount += 1;
    this.coinText.setText(`Moedas: ${this.coinCount}`);
  }

  /**
   * Encerra o jogo e abre a tela de game over.
   */
  endGame() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.physics.pause();

    if (this.spawnTimer) {
      this.spawnTimer.remove(false);
    }

    this.input.off("pointerdown", this.flap, this);
    this.upKey.off("down", this.flap, this);
    this.spaceKey.off("down", this.flap, this);

    const finalDistance = Math.floor(this.distance);
    const finalCoins = this.coinCount;

    this.time.delayedCall(550, () => {
      this.scene.start("GameOverScene", {
        distance: finalDistance,
        coins: finalCoins,
        total: finalDistance + finalCoins * 50
      });
    });
  }

  update(_time, delta) {
    if (this.isGameOver) {
      return;
    }

    // Dificuldade progressiva com o tempo.
    this.elapsedSeconds += delta / 1000;
    this.pipeSpeed = Phaser.Math.Clamp(this.speedStart + this.elapsedSeconds * 7.5, this.speedStart, this.speedMax);
    this.pipeGap = Phaser.Math.Clamp(this.gapStart - this.elapsedSeconds * 1.9, this.gapMin, this.gapStart);
    this.spawnDelay = Phaser.Math.Clamp(this.spawnStart - this.elapsedSeconds * 12, this.spawnMin, this.spawnStart);

    if (Math.abs(this.spawnTimer.delay - this.spawnDelay) > 20) {
      this.resetSpawnTimer();
    }

    // Movimento do fundo.
    this.bgFar.tilePositionX += (this.pipeSpeed * delta) / 6000;
    this.bgMid.tilePositionX += (this.pipeSpeed * delta) / 2400;

    // Score de distancia.
    this.distance += (this.pipeSpeed * delta) / 42000;
    this.distanceText.setText(`Distancia: ${Math.floor(this.distance)}m`);

    // Impede sair pela parte superior.
    if (this.fish.y < 70) {
      this.fish.y = 70;
      if (this.fish.body.velocity.y < 0) {
        this.fish.body.setVelocityY(0);
      }
    }

    // Rotacao do peixe de acordo com a velocidade vertical.
    this.fish.angle = Phaser.Math.Clamp(this.fish.body.velocity.y * 0.05, -20, 85);

    // Atualiza velocidade dos grupos com a dificuldade atual.
    this.pipes.setVelocityX(-this.pipeSpeed);
    this.coins.setVelocityX(-this.pipeSpeed);

    // Remove objetos que sairam da tela.
    this.pipes.children.iterate((pipe) => {
      if (pipe && pipe.x < -pipe.displayWidth) {
        pipe.destroy();
      }
    });

    this.coins.children.iterate((coin) => {
      if (coin && coin.x < -coin.displayWidth) {
        coin.destroy();
      }
    });
  }
}

/**
 * Cena 4: tela de game over.
 */
class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverScene" });
  }

  create(data) {
    this.add
      .image(GAME.width / 2, GAME.height / 2, "game_over")
      .setDisplaySize(GAME.width, GAME.height);

    this.add
      .text(
        GAME.width / 2,
        690,
        `Distancia: ${data.distance}m\nMoedas: ${data.coins}\nTotal: ${data.total}`,
        {
          fontFamily: "Arial",
          fontSize: "46px",
          color: "#ffffff",
          stroke: "#0f2a3d",
          strokeThickness: 8,
          align: "center"
        }
      )
      .setOrigin(0.5);

    buttonOverlay.init(this);
    buttonOverlay.showGameOver(
      () => this.scene.start("PlayScene"),
      () => this.scene.start("StartScene")
    );
  }
}

/**
 * Configuracao final do Phaser.
 */
const config = {
  type: Phaser.AUTO,
  width: GAME.width,
  height: GAME.height,
  backgroundColor: "#00142b",
  physics: {
    default: "arcade",
    arcade: {
      debug: true
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, StartScene, PlayScene, GameOverScene]
};

new Phaser.Game(config);
