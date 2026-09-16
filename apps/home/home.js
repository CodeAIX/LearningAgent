const diagram = document.querySelector(".constellation");
const captions = {
  ai: ["01 / AI", "从智能中，看见新的可能。"],
  xi: ["02 / XI", "让一个想法，进入真实场景。"],
  co: ["03 / CO", "让人与智能，共同创造价值。"],
};
document.querySelectorAll("[data-phase-button]").forEach((button) => {
  button.addEventListener("click", () => {
    const phase = button.dataset.phaseButton;
    if (!captions[phase]) return;
    diagram.dataset.phase = phase;
    document
      .querySelectorAll("[data-phase-button]")
      .forEach((node) =>
        node.setAttribute("aria-pressed", String(node === button)),
      );
    document.querySelector(".caption-index").textContent = captions[phase][0];
    document.querySelector(".diagram-caption p").textContent =
      captions[phase][1];
  });
});
