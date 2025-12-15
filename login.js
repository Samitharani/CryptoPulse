document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    
    const users = JSON.parse(localStorage.getItem("users")) || [];

  
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      
      alert(`Welcome back, ${user.fullname || "User"}!`);
      localStorage.setItem("loggedInUser", JSON.stringify(user));

    
      window.location.replace("index.html");
    } else {
    
      alert("Incorrect email or password. Please try again!");
    }
  });
});

localStorage.setItem("isLoggedIn", "true");
localStorage.setItem("loggedInUser", JSON.stringify({ email: userEmail }));

window.location.href = "index.html";
