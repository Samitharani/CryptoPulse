document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  console.log("Register button clicked!"); 

  const fullname = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  
  if (!fullname || !email || !password || !confirmPassword) {
    alert("Please fill in all fields!");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  
  let users = JSON.parse(localStorage.getItem("users")) || [];

  
  if (users.find(u => u.email === email)) {
    alert("An account with this email already exists. Please log in instead.");
    window.location.href = "login.html";
    return;
  }

  users.push({ fullname, email, password });
  localStorage.setItem("users", JSON.stringify(users));

  alert("🎉 Account created successfully! Please log in.");
  window.location.href = "login.html";
});
