document.getElementById("getStartedBtn").addEventListener("click", () => {
  const userLoggedIn = localStorage.getItem("isLoggedIn");

  if (userLoggedIn === "true") {
  
    window.location.href = "index.html";
  } else {
    
    window.location.href = "login.html";
  }
});
