import React, { useState } from "react";
import InputField from "../../components/InputField/InputField";

export default function LoginForm({ onSubmit }: { onSubmit?: (v:{username:string; password:string})=>void }){
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{username?:string; password?:string}>({});

  function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if(!username) nextErrors.username = "Username is required";
    if(!password) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    if(Object.keys(nextErrors).length===0){
      onSubmit?.({username, password});
    }
  }

  return (
    <form className="dh-form-reset" onSubmit={handleSubmit} noValidate>
      <InputField
        label="Username"
        placeholder="Enter username"
        value={username}
        onChange={e=>setUsername(e.target.value)}
        error={errors.username}
        autoComplete="username"
      />
      <div style={{height:".75rem"}} />
      <InputField
        label="Password"
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={e=>setPassword(e.target.value)}
        error={errors.password}
        autoComplete="current-password"
      />
      <div style={{height:"1rem"}} />
      <button type="submit">Log in</button>
    </form>
  );
}
