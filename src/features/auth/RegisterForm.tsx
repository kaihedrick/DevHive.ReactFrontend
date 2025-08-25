import React, { useState } from "react";
import InputField from "../../components/InputField/InputField";

export default function RegisterForm({ onSubmit }: { onSubmit?: (v:{username:string; email:string; password:string})=>void }){
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{username?:string; email?:string; password?:string}>({});

  function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if(!username) nextErrors.username = "Username is required";
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) nextErrors.email = "Valid email required";
    if(!password || password.length < 8) nextErrors.password = "Min 8 characters";
    setErrors(nextErrors);
    if(Object.keys(nextErrors).length===0){
      onSubmit?.({username, email, password});
    }
  }

  return (
    <form className="dh-form-reset" onSubmit={handleSubmit} noValidate>
      <InputField 
        label="Username" 
        placeholder="Choose a username" 
        value={username} 
        onChange={e=>setUsername(e.target.value)} 
        error={errors.username} 
        autoComplete="username" 
      />
      <div style={{height:".75rem"}} />
      <InputField 
        label="Email" 
        type="email" 
        placeholder="you@example.com" 
        value={email} 
        onChange={e=>setEmail(e.target.value)} 
        error={errors.email} 
        autoComplete="email" 
      />
      <div style={{height:".75rem"}} />
      <InputField 
        label="Password" 
        type="password" 
        placeholder="Create a password" 
        value={password} 
        onChange={e=>setPassword(e.target.value)} 
        error={errors.password} 
        autoComplete="new-password" 
      />
      <div style={{height:"1rem"}} />
      <button type="submit">Create account</button>
    </form>
  );
}
