document
.getElementById("loginForm")
.addEventListener("submit", function(e){

    e.preventDefault();

    let username =
        document.getElementById("username").value;

    let password =
        document.getElementById("password").value;

    if(username === "admin" &&
       password === "admin123")
    {
        localStorage.setItem("role","admin");

        window.location.href =
            "admin/dashboard.html";
    }
    else
    {
        alert("Customer login successful");

        localStorage.setItem("role","customer");

        window.location.href = "index.html";
    }
});