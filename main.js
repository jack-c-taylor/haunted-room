const config = {
  type: Phaser.CANVAS,
  parent: "haunted-room-game",
  width: 1000,
  height: 750,
  scene: {
    preload: preload,
    create: create,
  },
};

let phaserGame, scene, json, sceneIndex;
let layers = [];
let images = [];

// Load room content and image references before starting game.
fetch("./contents.json")
  .then((res) => res.json())
  .then((roomJson) => {
    json = roomJson;
  })
  .catch((e) => console.log(e))
  .finally(() => {
    phaserGame = new Phaser.Game(config);
    phaserGame.preserveDrawingBuffer = true;
  });

/* Load game textures during game setup. */
function preload() {
  // Load backgrounds and foregrounds.
  Object.keys(json).forEach((place) => {
    this.load.image(place, `./images/${place}.png`);

    // Load options for each layer.
    Object.values(json[place])
      .flatMap((x) => x.options)
      .forEach((option) => this.load.image(option, `./images/${option}.png`));

    // Load haunted elements, where present.
    Object.values(json[place])
      .filter((x) => x.haunting)
      .forEach((y) =>
        this.load.image(y.haunting, `./images/${y.haunting}.png`)
      );
  });

  // Load UI.
  ["reset", "toggle", "blank", "camera"].forEach((name) => {
    this.load.image(name, `./images/${name}.png`);
  });
}

/* Generate initial game display on load. */
function create() {
  scene = this;

  // Arrange layers in display order.
  createLayer("background");

  Object.values(json)
    .flatMap((x) => Object.keys(x))
    .forEach((name) => {
      let layer = createLayer(name);
      layer.single = true;
      layer.temporary = true;
    });

  // NOTE: Only one haunting should be visible at a time.
  let hauntLayer = createLayer("haunting");
  hauntLayer.single = true;
  hauntLayer.visible = false;

  createLayer("ux");

  // Display default content.
  loadInitialScene();

  // Display UX.
  createImage("blank", { layer: "ux", y: 650, width: 1000, height: 100 });
  createButton(
    "reset",
    { x: 10, y: 670, width: 60, height: 60 },
    loadInitialScene
  );
  createButton(
    "toggle",
    { x: 80, y: 670, width: 60, height: 60 },
    toggleBackground
  );

  createButton("camera", { x: 150, y: 670, width: 60, height: 60 }, hauntScene);

  // Generate menu options.
  let index = 0;
  Object.values(json).forEach((place) => {
    Object.keys(place).forEach((layer) => {
      // Create dividing bar.
      createImage("blank", {
        layer: "ux",
        x: 220 + 100 * index,
        y: 660,
        width: 5,
        height: 80,
      }).tint = 0x00000;

      // Display layer options.
      place[layer].options.forEach((item) => {
        createButton(
          item,
          {
            x: 240 + 100 * index,
            y: 670,
            width: 60,
            height: 60,
            preserveAspect: true,
          },
          () =>
            createImage(item, {
              layer: layer,
              x: place[layer].x,
              y: place[layer].y,
              width: place[layer].width,
              height: place[layer].height,
            })
        );
        index++;
      });
    });
  });
}

/* Display first available background, clearing previous content. */
function loadInitialScene() {
  clearImages();

  sceneIndex = -1;
  toggleBackground();
}

/* Cycle through backgrounds. */
function toggleBackground() {
  sceneIndex = (sceneIndex + 1) % Object.keys(json).length;
  createImage(Object.keys(json)[sceneIndex], { layer: "background" });
}

/* Briefly display camera-ready version of scene. */
function hauntScene() {
  let hauntLayer = layers.find((x) => x.name == "haunting");
  let uxLayer = layers.find((x) => x.name == "ux");
  if (!uxLayer || !hauntLayer || hauntLayer.visible) return;

  // Remove overlay.
  uxLayer.visible = false;
  hauntLayer.visible = true;

  // Display random haunting.
  const hauntings = Object.values(json)
    .flatMap((place) => Object.values(place))
    .filter((x) => x.haunting);

  if (hauntings.length > 0) {
    const haunt = randomItem(hauntings);
    createImage(haunt.haunting, {
      layer: "haunting",
      x: haunt.x,
      y: haunt.y,
      width: haunt.width,
      height: haunt.height,
    });
  }

  // Display card title.
  const caption = randomItem([
    "Happy birthday!!",
    "Victorian greetings",
    "Felicitations",
  ]);
  let title = scene.add
    .text(500, 670, caption, { fontSize: 30 })
    .setFontStyle("italic")
    .setOrigin(0.5, 0.5);

  // Restore overlay after 3 seconds.
  setTimeout(() => {
    title.destroy();
    uxLayer.visible = true;
    hauntLayer.visible = false;
  }, 3000);
}

/* Convert canvas data to screenshot. */
function takePicture() {
  hauntScene();

  // Attempt to take a screenshot.
  setTimeout(() => {
    try {
      let button = document.createElement("a");
      button.href = phaserGame.canvas.toDataURL();
      button.download = "birthday_card";
      document.body.appendChild(button);
      button.click();
      document.body.removeChild(button);
    } catch {
      console.log("Failed to capture screenshot.");
    }
  }, 100);
}

/**
 * Generate a layer tied to a top-level array.
 *
 * @param {string} name - The name to associate with the layer.
 * @returns {layer} layer - The new Phaser layer.
 */
function createLayer(name) {
  let layer = scene.add.layer();
  layer.name = name;
  layers.push(layer);

  return layer;
}

/**
 * Display a Phaser image.
 *
 * @param {string} name - The image key to load.
 * @param {Object} options - Further image properties.
 * @returns {Image} The displayed Phaser image.
 */
function createImage(name, options = {}) {
  let image = scene.add.image(options.x, options.y, name).setOrigin(0, 0);

  if (options.width && options.height) {
    const source = scene.textures.get(name).getSourceImage();

    const scaleX = options.width / source.width;
    const scaleY = options.height / source.height;
    options.preserveAspect
      ? image.setScale(Math.min(scaleX, scaleY))
      : image.setScale(scaleX, scaleY);
  }

  let parent = layers.find((x) => x.name == options.layer);
  if (parent) {
    if (parent.single) {
      parent.removeAll();
    }
    parent.add(image);
  } else {
    images.push(image);
  }

  return image;
}

/**
 * Display a Phaser image as if it were a clickable button.
 *
 * @param {string} name
 * @param {Object} options
 * @param {Function} action
 * @returns {Image} The created image with attached interactive logic.
 */
function createButton(name, options = {}, action) {
  options.layer = "ux";

  let button = createImage(name, options)
    .setInteractive()
    .setAlpha(0.5)
    .on("pointerover", () => (button.alpha = 1))
    .on("pointerout", () => (button.alpha = 0.5))
    .on("pointerup", action);

  return button;
}

/* Remove all non-UX elements from the page. */
function clearImages() {
  // Clear layered images.
  layers.forEach((layer) => {
    if (layer.temporary) {
      layer.removeAll();
    }
  });

  // Clear unsorted images.
  images.forEach((element) => {
    element?.destroy();
    element = null;
  });

  images = [];
}

/**
 * Return a random item from the provided array.
 *
 * @param {Array} array - The items to pick from.
 * @returns {*} An array item.
 */
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}
