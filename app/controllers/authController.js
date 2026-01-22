const users = new Map();

export function renderLogin(req, res) {
  res.render("login", { title: "Log In", error: null });
}

export function renderSignup(req, res) {
  res.render("signup", { title: "Sign Up", error: null });
}

export function handleSignup(req, res) {
  const { email, password, confirmPassword, name, phone, role, company } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Name, phone, email and password are required."
    });
  }
  if (password.length < 6) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Password must be at least 6 characters."
    });
  }
  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Passwords do not match."
    });
  }
  if (role !== "buyer" && role !== "seller") {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Please choose buyer or seller."
    });
  }
  if (role === "seller" && !company) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Company name is required for sellers."
    });
  }
  if (users.has(email)) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Email already exists."
    });
  }

  users.set(email, { email, password, name, phone, role, company: role === "seller" ? company : "" });
  res.cookie("authUser", email, { httpOnly: true });
  res.cookie("authUserRole", role, { httpOnly: true, sameSite: "lax" });
  return res.redirect("/homepage");
}

export function handleLogin(req, res) {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).render("login", {
      title: "Log In",
      error: "Invalid email or password."
    });
  }

  res.cookie("authUser", email, { httpOnly: true });
  if (user.role) {
    res.cookie("authUserRole", user.role, { httpOnly: true, sameSite: "lax" });
  }
  return res.redirect("/homepage");
}

export function handleLogout(req, res) {
  res.clearCookie("authUser");
  return res.redirect("/");
}
