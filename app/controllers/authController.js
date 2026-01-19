const users = new Map();

export function renderLogin(req, res) {
  res.render("login", { title: "Log In", error: null });
}

export function renderSignup(req, res) {
  res.render("signup", { title: "Sign Up", error: null });
}

export function handleSignup(req, res) {
  const { email, password, confirmPassword } = req.body;
  if (!email || !password) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Email and password are required."
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
  if (users.has(email)) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "Email already exists."
    });
  }

  users.set(email, { email, password });
  res.cookie("authUser", email, { httpOnly: true });
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
  return res.redirect("/homepage");
}

export function handleLogout(req, res) {
  res.clearCookie("authUser");
  return res.redirect("/");
}
