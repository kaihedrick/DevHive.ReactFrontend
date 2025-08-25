import React, { useState } from "react";
import clsx from "clsx";
import styles from "./AuthPage.module.css";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

export default function AuthPage(){
  const [tab, setTab] = useState<"login"|"register">("login");

  return (
    <div className={styles.authPage}>
      <div className={styles.tabRow}>
        <button 
          onClick={()=>setTab("login")} 
          aria-pressed={tab==="login"}
          className={clsx(tab === "login" && styles.active)}
        >
          Login
        </button>
        <button 
          onClick={()=>setTab("register")} 
          aria-pressed={tab==="register"}
          className={clsx(tab === "register" && styles.active)}
        >
          Register
        </button>
      </div>

      <div className={styles.panel}>
        {tab === "login" ? (
          <LoginForm onSubmit={(v)=>console.log("login", v)} />
        ) : (
          <RegisterForm onSubmit={(v)=>console.log("register", v)} />
        )}
      </div>
    </div>
  );
}
