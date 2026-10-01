export function startLogin() {
  const localUser = {
    id: 1,
    name: "Student",
    email: "student@crackingams.local",
    role: "user",
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem("manus-runtime-user-info", JSON.stringify(localUser));
  window.location.reload();
}
