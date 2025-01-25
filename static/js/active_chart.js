function chart_doughnut(
  chart_id,
  chart_label,
  chart_data,
  chart_colr,
  chart_title
) {
  const ctx = document.getElementById(chart_id).getContext("2d");
  ctx.height = 280;
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: chart_label,
      defaultFontFamily: "Poppins",
      datasets: [
        {
          data: chart_data,
          backgroundColor: chart_colr,
        },
      ],
    },
    options: {
      responsive: true,

      title: {
        display: true,
        text: chart_title,
      },
    },
  });
}

function spinner_wait(chart_id) {
  const myButton = document.getElementById(chart_id);
  const overlay = document.getElementById("overlay");

  myButton.addEventListener("click", () => {
    // Fade out the background
    overlay.style.display = "block";
    overlay.style.opacity = 0;
    let opacity = 0;
    const fadeInterval = setInterval(() => {
      if (opacity < 1) {
        opacity += 0.1;
        overlay.style.opacity = opacity;
      } else {
        clearInterval(fadeInterval);
      }
    }, 100);

    // Run the spinner
    const spinner = document.getElementById("spinner");
    spinner.style.display = "block";
  });
}

function downloadPDF() {
  const element = document.getElementById("myDiv");
  const rect = element.getBoundingClientRect();
  const element1 = document.getElementById("transcriptsec");
  // hide the full transcript and show only the "Read More" link
  element1.querySelector(".transcript").style.display = "block";

  if (element1.querySelector(".read-more")) {
    element1.querySelector(".read-more").style.display = "none";
    element1.querySelector(".read-more-link").style.display = "block";
  }

  html2canvas(element, {
    width: rect.width,
    height: rect.height,
  }).then((canvas) => {
    const pdf = new jsPDF();
    const imgData = canvas.toDataURL("image/png");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    // const pdfHeight = height;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("document.pdf");
  });
}

////////////////////////////////////////////////////////////////////// index html //////////////////////////////////////////////////////////////////////
/// javascript to desiplaying the privacy policy ////
// Get the modal
var modal = document.getElementById("myModal");
// Get the button that opens the modal
var btn = document.getElementById("policy");
// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];
// When the user clicks the button, open the modal
btn.onclick = function () {
  modal.style.display = "block";
};
// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
};
// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

////// javascript to enable and disable start button based on the condition if the checkbox is clicked or not /////////
const myCheckbox = document.getElementById("policy_check");
const myButton = document.getElementById("startButton");
myCheckbox.addEventListener("change", function () {
  if (this.checked) {
    myButton.disabled = false;
  } else {
    myButton.disabled = true;
  }
});
