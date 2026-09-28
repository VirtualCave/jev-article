"use client";

import { motion, useReducedMotion } from "motion/react";

export function JevMark({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return <svg viewBox="0 0 200 200" role="img" aria-label="Jev" className={className}>
    <motion.path d="M 100,10 L 177.94,55 L 142,75.75 L 100,51.5 L 58,75.75 L 22.06,55 Z" fill="#B8144D" initial={reduce ? false : { opacity: 0, y: -22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, ease: [0.16, 1, 0.3, 1] }} />
    <motion.path d="M 22.06,55 L 58,75.75 L 58,124.25 L 100,148.5 L 142,124.25 L 142,75.75 L 177.94,55 L 177.94,145 L 100,190 L 22.06,145 Z" fill="#304777" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .7 }} />
  </svg>;
}
