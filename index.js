import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt, { hash } from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import env from "dotenv";

const app = express();
const saltRounds = 10;

env.config();
const db = new pg.Client({
  user: process.env.PG_USER,
  database: process.env.PG_DATABASE,
  host: process.env.PG_HOST,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.connect();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.render("home.ejs")
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if(err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/secrets", (req, res) => {
  if(req.isAuthenticated()) {
    res.redirect("/secrets");
  } else {
    res.redirect("/login");
  }
});

app.get("/auth/google", passport.authenticate("google", {
  scope: ['profile', 'email']
}));

app.get("/auth/google/secrets", passport.authenticate("google", {
  successRedirect: "/secrets",
  failureRedirect: "/login",
}));

app.post("/login", passport.authenticate("local", {
  successRedirect: "/secrets",
  failureRedirect: "/login",
}));

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  try{
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if(checkResult.rows.length > 0) {
      req.redirect("/login");
    } else {
      bcrypt.hash(password, hash, async(err, hash) => {
        if(err) {
          console.log(err);
        } else {
          const result = await db.query("INSERT INTO user (email, password) VALUES ($1, $2) RETURNING *", [email, hash]);
          const user = result.rows[0];
          console.log(user);

          req.login(user, (err) => {
            console.log("Successfull..");
            res.redirect("/secrets");
          });
        }
      });
    }
  } catch(error) {
    console.log(error.message);
    res.send(error.message);
  }
});


passport.use("local", new Strategy(async function verify(username, password, cb) {
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      const storedPassword = result.rows[0].password;
      bcrypt.compare(password, storedPassword, (err, result) => {
        if(err) {
          console.log(err);
        } else {
          if(valid) {
            return cb(null, user);
          } else {
            return cb(null, false);
          }
        }
      })
    } else {
      return cb("USER NOT FOUND. TRY TO REGISTER...")
    }
  } catch(err) {
    console.log(err);
  } 
}));

passport.use("google", new GoogleStrategy ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
 },
  async (recieveToken, refreshToken, profile, cb) => {
    try {
      console.log(profile);
      const result = await db.query("SELECT * FROM user WHER email=$1", [profile.email]);
      if(result.rows.length === 0) {
        const newUser = await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [profile.email, "google"]);
        return cb(null, newUser.rows[0]);
      }else {
        return cb(null, result.rows[0]);
      }
    } catch(err) {
      console.log(err);
    }
  }
))

passport.serializeUser((user, cb) => {
  return cb(null, user);
});

passport.deserializeUser((user, cb) => {
  return cb(null, user);
})

app.listen(3000, (req, res) => {
  console.log("Server running on port 3000 ...");
});