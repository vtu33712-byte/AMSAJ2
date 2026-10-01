export function startLogin() {
  const localUser = {
    id: 1,
    name: "Student",
    email: "student@crackingams.local",
    role: "user",
  };
  localStorage.setItem("cracking-ams-user", JSON.stringify(localUser));
  localStorage.setItem("manus-runtime-user-info", JSON.stringify(localUser));
  window.dispatchEvent(new CustomEvent("cracking-ams-auth-change", { detail: localUser }));
}
