const loginScreen = document.getElementById("loginScreen");
const loadingScreen = document.getElementById("loadingScreen");
const bootScreen = document.getElementById("bootScreen");
const finalScreen = document.getElementById("finalScreen");

const loginButton = document.getElementById("loginButton");

const loginProgress = document.getElementById("loginProgress");
const loginPercent = document.getElementById("loginPercent");

const bootLinesContainer = document.getElementById("bootLines");
const bootProgress = document.getElementById("bootProgress");
const bootPercent = document.getElementById("bootPercent");

const desktopScreen =
    document.getElementById("desktopScreen");

const emailForm =
    document.getElementById("emailForm");

const emailInput =
    document.getElementById("emailInput");

const emailMessage =
    document.getElementById("emailMessage");

const emailSubmitButton =
    document.getElementById("emailSubmitButton");





const bootMessages = [
    "CHECKING SYSTEM INTEGRITY",
    "LOADING CORE MODULES",
    "VERIFYING ENCRYPTION KEYS",
    "MOUNTING SECURE DRIVES",
    "INITIALIZING NETWORK PROTOCOLS",
    "STARTING SYSTEM SERVICES",
    "LOADING ZOMB LABS ARCHIVES",
    "FINALIZING ZombOS BOOT SEQUENCE"
];

loginButton.addEventListener("click", startLogin);

function showScreen(screenToShow) {
    const screens = document.querySelectorAll(".screen");

    screens.forEach((screen) => {
        screen.classList.remove("active");
    });

    screenToShow.classList.add("active");
}

function startLogin() {
    loginButton.disabled = true;

    showScreen(loadingScreen);

    runProgressBar({
        bar: loginProgress,
        percentText: loginPercent,
        duration: 2200,
        onComplete: startBootSequence
    });
}

function startBootSequence() {
    showScreen(bootScreen);

    bootLinesContainer.innerHTML = "";

    let currentLine = 0;

    const lineInterval = setInterval(() => {
        addBootLine(bootMessages[currentLine]);

        currentLine++;

        const progress = Math.round(
            (currentLine / bootMessages.length) * 100
        );

        bootProgress.style.width = `${progress}%`;
        bootPercent.textContent = `${progress}%`;

        //flashScreen();

        if (currentLine >= bootMessages.length) {
            clearInterval(lineInterval);

            setTimeout(showFinalScreen, 900);
        }
    }, 480);
}

function addBootLine(message) {
    const line = document.createElement("div");

    line.className = "boot-line";

    line.innerHTML = `
        <span>&gt; ${message}</span>
        <span>OK</span>
    `;

    bootLinesContainer.appendChild(line);
}

function showFinalScreen() {
    showScreen(finalScreen);

    flashScreen();

    setTimeout(() => {
        showScreen(desktopScreen);
        flashScreen();
    }, 2500);
}

function runProgressBar({
    bar,
    percentText,
    duration,
    onComplete
}) {
    const startTime = performance.now();

    function updateProgress(currentTime) {
        const elapsed = currentTime - startTime;

        const progress = Math.min(
            elapsed / duration,
            1
        );

        const percentage = Math.round(progress * 100);

        bar.style.width = `${percentage}%`;
        percentText.textContent = `${percentage}%`;

        if (progress < 1) {
            requestAnimationFrame(updateProgress);
        } else {
            setTimeout(onComplete, 400);
        }
    }

    requestAnimationFrame(updateProgress);
}

function flashScreen() {
    document.body.classList.remove("screen-flash");

    void document.body.offsetWidth;

    document.body.classList.add("screen-flash");
}




emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value
        .trim()
        .toLowerCase();

    if (!email) {
        showEmailMessage(
            "ERROR: EMAIL ADDRESS REQUIRED.",
            "error"
        );

        return;
    }

    emailSubmitButton.disabled = true;
    emailSubmitButton.textContent = "TRANSMITTING...";

    showEmailMessage(
        "> CONNECTING TO HORDE NETWORK...",
        "success"
    );

    try {
        const response = await fetch(
            "https://formsubmit.co/ajax/zomblabsmain@gmail.com",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    _subject: "New Zomb Labs System Update Subscriber",
                    _template: "table"
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Submission failed"
            );
        }

        showEmailMessage(
            "REGISTRATION COMPLETE. SYSTEM UPDATES ENABLED.",
            "success"
        );

        emailForm.reset();
    } catch (error) {
        console.error(error);

        showEmailMessage(
            "TRANSMISSION FAILED. PLEASE TRY AGAIN.",
            "error"
        );
    } finally {
        emailSubmitButton.disabled = false;
        emailSubmitButton.textContent =
            "ENABLE SYSTEM UPDATES";
    }
});

function showEmailMessage(message, type) {
    emailMessage.textContent = message;

    emailMessage.className =
        `email-message ${type}`;
}