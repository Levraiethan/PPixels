"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function DevRegister(){
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={{padding:40}}>
      <h1>DEV Register/Login</h1>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={()=>signIn("credentials", { email, password, callbackUrl: "/" })}>Entrer</button>
    </div>
  );
}
