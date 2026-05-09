const leadForm = document.getElementById("leadForm");
const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
}

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(leadForm);
  const name = String(data.get("name") || "").trim();
  const area = String(data.get("area") || "").trim();
  const mobile = String(data.get("mobile") || "").trim();

  showToast(`Thanks ${name}. Amanwiz Ifotech will contact you for ${area}. For urgent help call 9918675387.`);
  const whatsappText = encodeURIComponent(
    `New internet enquiry\nName: ${name}\nArea: ${area}\nMobile: ${mobile}`
  );

  window.open(`https://wa.me/919918675387?text=${whatsappText}`, "_blank", "noopener,noreferrer");
  leadForm.reset();
});
