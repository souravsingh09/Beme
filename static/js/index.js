// Get the video element by its ID
const video = document.getElementById("video");
let mediaRecorder;
let recordedChunks = [];
// Initialize an empty list to store dominant expressions
let dominantExpressionsList = [];

let isRecording = false;
let detectionIntervalId = null;
// let eye_contact_frames = 0;
// let total_frames = 0;
// Add these variables at the beginning of your code

const uploadURL = "{{ url_for('upload_audio') }}";

// Load required faceapi models
// Promise.all([
//   faceapi.nets.ssdMobilenetv1.loadFromUri("./static/models"),
//   faceapi.nets.faceLandmark68Net.loadFromUri("./static/models"),
//   faceapi.nets.faceRecognitionNet.loadFromUri("./static/models"),
//   faceapi.nets.faceExpressionNet.loadFromUri("./static/models"),
//   faceapi.nets.ageGenderNet.loadFromUri("./static/models"),
// ]).then(startVideo);

// console.log("Starting to load models...");
// // Hide the video initially
// const videoElement = document.getElementById('video');
// videoElement.style.display = 'none';
// Promise.all([
//  faceapi.nets.ssdMobilenetv1.loadFromUri("./static/models"),
//  faceapi.nets.faceLandmark68Net.loadFromUri("./static/models"),
//  faceapi.nets.faceRecognitionNet.loadFromUri("./static/models"),
//  faceapi.nets.faceExpressionNet.loadFromUri("./static/models"),
//  faceapi.nets.ageGenderNet.loadFromUri("./static/models"),
// ]).then(() => {
//  console.log("All models loaded successfully");
//  // Show the video and remove the loading overlay
//  videoElement.style.display = 'block';
//  const loadingOverlay = document.getElementById('loading-overlay');
//  loadingOverlay.parentNode.removeChild(loadingOverlay);
//  startVideo();
// }).catch(error => {
//  console.error("Model loading failed:", error);
// });

// console.log("Starting to load models...");
// // Show loading message
// const loadingMessageElement = document.getElementById('loading-message');
// // loadingMessageElement.textContent = "Loading models...";


console.log("Starting to load models...");
const loadingMessageElement = document.getElementById('loading-message');
Promise.all([
 faceapi.nets.ssdMobilenetv1.loadFromUri("./static/models"),
 faceapi.nets.faceLandmark68Net.loadFromUri("./static/models"),
 faceapi.nets.faceRecognitionNet.loadFromUri("./static/models"),
 faceapi.nets.faceExpressionNet.loadFromUri("./static/models"),
 faceapi.nets.ageGenderNet.loadFromUri("./static/models"),
]).then(() => {
 console.log("All models loaded successfully");
 loadingMessageElement.textContent = "Now you can record your session";
 setTimeout(() => {
   document.getElementById('loading-overlay').style.display = 'none';
 }, 5000); // Hide the overlay after 2 seconds
 startVideo();
}).catch(error => {
 console.error("Model loading failed:", error);
});





function startVideo() {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((err) => console.error(err));
}

const startButton = document.getElementById("startButton");
startButton.addEventListener("click", async () => {
  detectionIntervalId = await startEmotionDetection();
  startAudioRecording();
  startButton.disabled = true;
  endButton.disabled = false;
  isRecording = true;
});

async function startAudioRecording() {
  console.log("Recording started");
  const stream = video.srcObject;
  const audioTracks = stream.getAudioTracks();

  if (audioTracks.length === 0) {
    console.error("No audio tracks available.");
    return;
  }

  const audioStream = new MediaStream();
  audioStream.addTrack(audioTracks[0]);

  try {
    mediaRecorder = new MediaRecorder(audioStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("Recording stopped");

      const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });

      const formData = new FormData();
      formData.set("audio", audioBlob, "audioToSave.wav");
      formData.append(
        "dominantExpressions",
        JSON.stringify(dominantExpressionsList)
      );

      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/beme/upload_audio", true);
      xhr.onreadystatechange = function () {
        console.log("Error onnnnnnn: " + xhr.readyStates);
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            // Request completed and successful, do something with the response
            console.log(xhr.responseText);

            window.location.href = "/beme/report";
          } else {
            // Request completed but with an error status
            console.error("Error: " + xhr.status);
          }
        }
      };
      xhr.send(formData);
      console.log("Starting speech recognition");

      // Clear the list after sending
      dominantExpressionsList = [];

      recordedChunks = [];
    };

    mediaRecorder.start();
    console.log("Recording started...");
  } catch (error) {
    console.error("Error starting audio recording:", error);
  }
}

const endButton = document.getElementById("endButton");
endButton.addEventListener("click", () => {
  try {
    stopAudioRecording();
  } catch (error) {
    console.error("An error occurred while stopping audio recording:", error);
  }
});

function stopAudioRecording() {
  console.log("Recording ended");

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    stopEmotionDetection();
    isRecording = false;
    startButton.disabled = false;
    endButton.disabled = true;
  }
}

function stopEmotionDetection() {
  console.log("stopEmotionDetection");
  clearInterval(detectionIntervalId);
  const canvas = document.querySelector("canvas");
  if (canvas) {
    canvas.remove();
  }
}

function drawBoundingBox(
  canvasContext,
  x1,
  y1,
  x2,
  y2,
  color,
  thickness,
  r,
  d
) {
  // Top left
  canvasContext.beginPath();
  canvasContext.moveTo(x1 + r, y1);
  canvasContext.lineTo(x1 + r + d, y1);
  canvasContext.moveTo(x1, y1 + r);
  canvasContext.lineTo(x1, y1 + r + d);
  canvasContext.ellipse(x1 + r, y1 + r, r, r, Math.PI, 0, Math.PI / 2);
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = thickness;
  canvasContext.stroke();

  // Top right
  canvasContext.beginPath();
  canvasContext.moveTo(x2 - r, y1);
  canvasContext.lineTo(x2 - r - d, y1);
  canvasContext.moveTo(x2, y1 + r);
  canvasContext.lineTo(x2, y1 + r + d);
  canvasContext.ellipse(x2 - r, y1 + r, r, r, 1.5 * Math.PI, 0, 0.5 * Math.PI);
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = thickness;
  canvasContext.stroke();

  // Bottom left
  canvasContext.beginPath();
  canvasContext.moveTo(x1 + r, y2);
  canvasContext.lineTo(x1 + r + d, y2);
  canvasContext.moveTo(x1, y2 - r);
  canvasContext.lineTo(x1, y2 - r - d);
  canvasContext.ellipse(x1 + r, y2 - r, r, r, 0.5 * Math.PI, 0, 1.5 * Math.PI);
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = thickness;
  canvasContext.stroke();

  // Bottom right
  canvasContext.beginPath();
  canvasContext.moveTo(x2 - r, y2);
  canvasContext.lineTo(x2 - r - d, y2);
  canvasContext.moveTo(x2, y2 - r);
  canvasContext.lineTo(x2, y2 - r - d);
  canvasContext.ellipse(x2 - r, y2 - r, r, r, 0, 0, 0.5 * Math.PI);
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = thickness;
  canvasContext.stroke();
}

async function startEmotionDetection() {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  // Match canvas dimensions with video dimensions
  canvas.width = video.offsetWidth;
  canvas.height = video.offsetHeight;

  const displaySize = {
    width: video.offsetWidth,
    height: video.offsetHeight,
  };
  faceapi.matchDimensions(canvas, displaySize);

  const emotions = [
    "neutral",
    "happy",
    "sad",
    "angry",
    "fearful",
    "disgusted",
    "surprised",
  ];

  const intervalId = setInterval(async () => {
    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
        .withAgeAndGender()
        .withFaceExpressions();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

      if (detections.length > 0) {
        const expressions = detections[0].expressions;
        const gender = detections[0].gender;

        const expressionCounts = {};
        emotions.forEach((emotion) => {
          expressionCounts[emotion] = expressions[emotion];
        });

        let dominantExpression = "neutral";
        let maxConfidence = 0;
        for (const emotion of emotions) {
          if (expressionCounts[emotion] > maxConfidence) {
            maxConfidence = expressionCounts[emotion];
            dominantExpression = emotion;
            // Append dominant expression to the list
            dominantExpressionsList.push(dominantExpression);
          }
        }

        // Draw the bounding box using the adjusted coordinates
        const box = resizedDetections[0].detection.box;
        // Adjust coordinates if video is mirrored
        const adjustedX =
          video.style.transform === "scaleX(-1)"
            ? canvas.width - (box.x + box.width)
            : box.x;

        // Ensure the bounding box coordinates are within canvas bounds
        const canvasX = Math.max(
          0,
          Math.min(adjustedX, canvas.width - box.width)
        );

        const canvasY = Math.max(
          0,
          Math.min(box.y, canvas.height - box.height)
        );

        // Calculate the center point of the bounding box
        const boxCenterX = canvasX + box.width / 2;
        const boxCenterY = canvasY + box.height / 2;

        // Create the text to display
        const text = `${dominantExpression} ${gender}`;
        const textSize = canvas.getContext("2d").measureText(text);

        // Calculate text position relative to the center of the bounding box
        const textX = boxCenterX - textSize.width / 2;
        const textY = canvasY - 10;

        // Draw the text above the bounding box
        canvas.getContext("2d").font = "25px Arial";
        canvas.getContext("2d").textAlign = "center";
        canvas.getContext("2d").fillStyle = "red";
        canvas.getContext("2d").fillText(text, textX, textY);

        // Draw bounding box
        const ctx = canvas.getContext("2d");
        drawBoundingBox(
          ctx,
          canvasX,
          canvasY,
          canvasX + box.width,
          canvasY + box.height,
          "blue",
          6,
          10,
          15
        );
      }
    } catch (error) {
      console.error("Error processing detections:", error);
    }
  }, 100);
  return intervalId; // Interval duration in milliseconds
}

// Call startVideo to begin the video stream and emotion detection
startVideo();
