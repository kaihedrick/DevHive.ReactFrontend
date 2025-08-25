import React, { useState } from "react";
import InputField from "../../components/InputField/InputField";

export default function ForgotPasswordForm({ onSubmit }: { onSubmit?: (v:{email:string})=>void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string|undefined>();

  function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Valid email required"); return; }
    onSubmit?.({ email });
  }

  return (
    <form className="dh-form-reset" onSubmit={handle} noValidate>
      <InputField 
        label="Email" 
        type="email" 
        placeholder="you@example.com" 
        value={email}
        onChange={e=>{setEmail(e.target.value); setError(undefined);}} 
        error={error} 
        autoComplete="email" 
      />
      <div style={{ height: "1rem" }} />
      <button type="submit">Send reset link</button>
    </form>
  );
}
