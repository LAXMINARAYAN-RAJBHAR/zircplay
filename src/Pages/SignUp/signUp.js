import React, { useState } from "react";
import "./signUp.css";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../config/supabase";

const DEFAULT_PIC =
  "https://ui-avatars.com/api/?name=User&background=7c3aed&color=fff&size=100";

const SignUp = () => {
  const navigate = useNavigate();
  const [uploadedImageUrl, setUploadedImageUrl] = useState(DEFAULT_PIC);
  const [signUpField, setSignUpField] = useState({
    channelName: "",
    userName: "",
    email: "",
    password: "",
    about: "",
    profilePic: DEFAULT_PIC,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleInputField = (event, name) => {
    setSignUpField({ ...signUpField, [name]: event.target.value });
    setError("");
  };

  const uploadImage = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const data = new FormData();
    data.append("file", files[0]);
    data.append("upload_preset", "zixplon-data");
    try {
      const response = await axios.post(
        "https://api.cloudinary.com/v1_1/uaa756bj/image/upload",
        data,
      );
      const imageUrl = response.data.secure_url;
      setUploadedImageUrl(imageUrl);
      setSignUpField((prev) => ({ ...prev, profilePic: imageUrl }));
    } catch (err) {
      setError("Image upload failed. Please try again.");
    }
  };

  // ── Check if username is already taken ──
  const isUsernameTaken = async (username) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (error) return false; // fail open — DB will catch it
    return !!data;
  };

  const handleSignUp = async () => {
    // ── Validation ──
    const channelName = signUpField.channelName.trim();
    const userName    = signUpField.userName.trim().toLowerCase();
    const email       = signUpField.email.trim().toLowerCase();
    const password    = signUpField.password;
    const about       = signUpField.about.trim();
    const profilePic  = signUpField.profilePic;

    if (!channelName)  return setError("Please enter a Channel Name.");
    if (!userName)     return setError("Please enter a User Name.");
    if (/\s/.test(userName))
      return setError("Username cannot contain spaces. Use dots or underscores (e.g. john.doe)");
    if (!/^[a-zA-Z0-9._]+$/.test(userName))
      return setError("Username can only contain letters, numbers, dots, and underscores.");
    if (!email)        return setError("Please enter an Email.");
    if (!password)     return setError("Please enter a Password.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // ── Step 1: Check username availability ──
      const taken = await isUsernameTaken(userName);
      if (taken) {
        setLoading(false);
        return setError("This username is already taken. Please choose another.");
      }

      // ── Step 2: Create auth user ──
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            // Store channelName in auth metadata as backup
            channel_name: channelName,
            username: userName,
          },
        },
      });

      console.log("Supabase signUp →", { data, signUpError });

      if (signUpError) {
        // Surface friendly messages for common errors
        const msg = signUpError.message || "";
        if (msg.toLowerCase().includes("already registered") || msg.includes("already exists")) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        }
        throw signUpError;
      }

      const user = data?.user;
      if (!user) {
        throw new Error("Sign up failed — no user returned. Please try again.");
      }

      // Supabase returns identities:[] when email is already registered
      // (even without email confirmation enabled)
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      // ── Step 3: Upsert profile row (includes channelName!) ──
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          [
            {
              id:           user.id,
              username:     userName,
              channel_name: channelName,   // ← was missing before
              profile_pic:  profilePic,
              about:        about,
              banner_pic:   "",
            },
          ],
          { onConflict: "id" }
        );

      if (profileError) {
        // username unique constraint violation
        if (profileError.code === "23505" || profileError.message?.includes("unique")) {
          throw new Error("This username is already taken. Please choose another.");
        }
        throw new Error("Profile setup failed: " + profileError.message);
      }

      // ── Step 4: Persist to localStorage ──
      const keys = ["username","userId","email","profilePic","about","channelName","userName"];
      keys.forEach((k) => localStorage.removeItem(k));

      localStorage.setItem("userId",      user.id);
      localStorage.setItem("username",    userName);
      localStorage.setItem("channelName", channelName);
      localStorage.setItem("userName",    userName);
      localStorage.setItem("email",       email);
      localStorage.setItem("profilePic",  profilePic);
      localStorage.setItem("about",       about);

      // ── Step 5: Feedback & redirect ──
      const emailConfirmRequired = !data.session;
      if (emailConfirmRequired) {
        setSuccess("Account created! Please check your email to confirm, then sign in.");
        setLoading(false);
        setTimeout(() => navigate("/signin"), 3500);
      } else {
        setSuccess("Account created! Redirecting…");
        setLoading(false);
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || "Sign up failed. Please try again.");
    }
  };

  // Allow Enter key on any field to submit
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleSignUp();
  };

  return (
    <div className="signUp">
      <div className="signup_card">
        <div className="signUp_title">
          <AccountCircleIcon
            sx={{ fontSize: "54px" }}
            className="login_youtubeImage"
          />
          Sign Up
        </div>

        <div className="signUp_Inputs">
          <input
            type="text"
            className="signUp_Inputs_inp"
            value={signUpField.channelName}
            onChange={(e) => handleInputField(e, "channelName")}
            onKeyDown={handleKeyDown}
            placeholder="Channel Name * (e.g. My Awesome Channel)"
          />
          <input
            type="text"
            className="signUp_Inputs_inp"
            value={signUpField.userName}
            onChange={(e) => handleInputField(e, "userName")}
            onKeyDown={handleKeyDown}
            placeholder="User Name * (no spaces, e.g. john.doe)"
          />
          <input
            type="email"
            className="signUp_Inputs_inp"
            value={signUpField.email}
            onChange={(e) => handleInputField(e, "email")}
            onKeyDown={handleKeyDown}
            placeholder="Email Address *"
          />
          <input
            type="password"
            className="signUp_Inputs_inp"
            value={signUpField.password}
            onChange={(e) => handleInputField(e, "password")}
            onKeyDown={handleKeyDown}
            placeholder="Password * (min 6 chars)"
          />
          <input
            type="text"
            className="signUp_Inputs_inp"
            value={signUpField.about}
            onChange={(e) => handleInputField(e, "about")}
            onKeyDown={handleKeyDown}
            placeholder="About Your Channel (optional)"
          />

          {/* Profile Picture Upload */}
          <div className="image_upload_signup">
            <input type="file" accept="image/*" onChange={uploadImage} />
            <div className="image_upload_signup_div">
              <img
                className="image_default_signup"
                src={uploadedImageUrl}
                alt="Profile Preview"
                onError={(e) => { e.target.src = DEFAULT_PIC; }}
              />
            </div>
          </div>

          {/* Error / Success Messages */}
          {error && (
            <div className="signup_message signup_message--error">
              ❌ {error}
            </div>
          )}
          {success && (
            <div className="signup_message signup_message--success">
              ✅ {success}
            </div>
          )}

          <div className="signUpBtns">
            <div
              className={`signUpBtn${loading ? " signUpBtn--loading" : ""}`}
              onClick={!loading ? handleSignUp : undefined}
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </div>
            <Link to={"/"} className="signUpBtn">
              Home Page
            </Link>
          </div>

          <p style={{ color: "#8b84c4", fontSize: "14px", marginTop: "8px" }}>
            Already have an account?{" "}
            <span
              onClick={() => navigate("/signin")}
              style={{
                color: "var(--zx-primary)",
                cursor: "pointer",
                fontWeight: "700",
              }}
            >
              Sign In
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;