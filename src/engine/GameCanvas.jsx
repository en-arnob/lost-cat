import { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import boyGLB from "../models/boy.glb"

export default function GameCanvas() {
  const canvasRef = useRef(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.7, 0.9, 1, 1);

    // Create a third-person camera with mouse controls
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      0, // Alpha (horizontal rotation around character)
      Math.PI / 3, // Beta (vertical angle)
      10, // Radius (distance from character)
      BABYLON.Vector3.Zero(), // Target (will be updated to character position)
      scene
    );

    // Enable mouse controls
    camera.attachControl(canvas, true);
    camera.lowerBetaLimit = 0.1; // Prevent camera from going below ground
    camera.upperBetaLimit = Math.PI / 2.1; // Prevent camera from going too high
    camera.lowerRadiusLimit = 3; // Minimum zoom
    camera.upperRadiusLimit = 20; // Maximum zoom

    // Lighting
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light.intensity = 0.8;

    // Additional directional light for better character visibility
    const dirLight = new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(-1, -1, -1),
      scene
    );
    dirLight.intensity = 0.5;

    // Ground with texture-like appearance
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 50, height: 50 },
      scene
    );
    const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.3);
    ground.material = groundMaterial;

    // Input handling
    const inputMap = {};
    scene.actionManager = new BABYLON.ActionManager(scene);

    scene.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnKeyDownTrigger,
        (evt) => {
          inputMap[evt.sourceEvent.key.toLowerCase()] = true;
        }
      )
    );

    scene.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnKeyUpTrigger,
        (evt) => {
          inputMap[evt.sourceEvent.key.toLowerCase()] = false;
        }
      )
    );

    // Character will be loaded from GLB file
    let character = null;
    let idleAnimation = null;
    let walkAnimation = null;
    let currentlyPlaying = "idle";

    // Load your character GLB file
    BABYLON.SceneLoader.ImportMesh(
      "",
      "",
      boyGLB,
      scene,
      (meshes, _, __, animationGroups) => {
        character = meshes[0];
        character.position = new BABYLON.Vector3(0, 0, 0);
        character.scaling = new BABYLON.Vector3(1, 1, 1);

        // Stop all animations first
        animationGroups.forEach((anim) => anim.stop());

        // Find animations
        idleAnimation = animationGroups.find((anim) =>
          anim.name.toLowerCase().includes("idle")
        );
        walkAnimation = animationGroups.find((anim) =>
          anim.name.toLowerCase().includes("walk")
        );

        idleAnimation?.start(true);
      }
    );

    // Character movement variables
    let moveVector = new BABYLON.Vector3(0, 0, 0);
    const speed = 0.15;
    const rotationSpeed = 0.15;

    // Main render loop
    scene.onBeforeRenderObservable.add(() => {
      // Only proceed if character is loaded
      if (!character) return;

      moveVector.setAll(0);
      let isMoving = false;

      // Get camera's horizontal rotation for camera-relative movement
      const cameraAngle = camera.alpha;

      // Camera-relative movement (like modern 3D games)
      if (inputMap["w"] || inputMap["arrowup"]) {
        // Move forward relative to camera
        moveVector.x = Math.sin(cameraAngle);
        moveVector.z = Math.cos(cameraAngle);
        isMoving = true;
      }
      if (inputMap["s"] || inputMap["arrowdown"]) {
        // Move backward relative to camera
        moveVector.x = -Math.sin(cameraAngle);
        moveVector.z = -Math.cos(cameraAngle);
        isMoving = true;
      }
      if (inputMap["a"] || inputMap["arrowleft"]) {
        // Strafe left relative to camera
        moveVector.x = Math.sin(cameraAngle - Math.PI / 2);
        moveVector.z = Math.cos(cameraAngle - Math.PI / 2);
        isMoving = true;
      }
      if (inputMap["d"] || inputMap["arrowright"]) {
        // Strafe right relative to camera
        moveVector.x = Math.sin(cameraAngle + Math.PI / 2);
        moveVector.z = Math.cos(cameraAngle + Math.PI / 2);
        isMoving = true;
      }

      if (isMoving) {
        // Normalize movement vector for consistent speed
        moveVector.normalize();
        moveVector.scaleInPlace(speed);

        // Move character
        character.position.addInPlace(moveVector);

        // Rotate character to face movement direction smoothly
        const targetRotation = Math.atan2(moveVector.x, moveVector.z);

        // Get current rotation and smoothly interpolate
        const currentRotation = character.rotation.y;
        let rotationDiff = targetRotation - currentRotation;

        // Handle rotation wraparound (shortest path)
        if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

        character.rotation.y += rotationDiff * rotationSpeed;

        // Animation switching
        if (currentlyPlaying !== "walk") {
          idleAnimation?.stop();
          walkAnimation?.start(true);
          currentlyPlaying = "walk";
        }

        setIsMoving(true);
      } else {
        // Animation switching to idle
        if (currentlyPlaying !== "idle") {
          walkAnimation?.stop();
          idleAnimation?.start(true);
          currentlyPlaying = "idle";
        }

        setIsMoving(false);
      }

      // Update camera target to follow character smoothly
      const targetPosition = character.position
        .clone()
        .add(new BABYLON.Vector3(0, 1.5, 0));
      camera.setTarget(
        BABYLON.Vector3.Lerp(camera.getTarget(), targetPosition, 0.1)
      );
    });

    /* 
    // Remove this commented section - we're now using the actual GLB file
    */

    engine.runRenderLoop(() => {
      scene.render();
    });

    window.addEventListener("resize", () => {
      engine.resize();
    });

    return () => {
      engine.dispose();
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          background: "rgba(0,0,0,0.7)",
          padding: "10px",
          borderRadius: "5px",
        }}
      >
        <div>🎮 Controls:</div>
        <div>WASD / Arrow Keys - Move (camera relative)</div>
        <div>Mouse - Rotate Camera</div>
        <div>Mouse Wheel - Zoom In/Out</div>
        <div
          style={{ marginTop: "10px", color: isMoving ? "#4ade80" : "#64748b" }}
        >
          Status: {isMoving ? "Moving" : "Idle"}
        </div>
      </div>
    </div>
  );
}
