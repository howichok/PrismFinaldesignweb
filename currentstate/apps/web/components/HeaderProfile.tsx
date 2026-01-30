"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { type SessionData } from "@/lib/auth/types";
import { csrfFetch } from "@/lib/security/csrf-client";

type HeaderProfileProps = {
    session: SessionData;
};

export default function HeaderProfile({ session }: HeaderProfileProps) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleLogout = async () => {
        await csrfFetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="profile" ref={wrapperRef}>
            <div className="profile__trigger" onClick={() => setOpen(!open)}>
                {session.avatarUrl ? (
                    <img
                        src={session.avatarUrl}
                        alt={session.displayName}
                        className="profile__avatar"
                    />
                ) : (
                    <div className="profile__initials">
                        {session.displayName.slice(0, 2)}
                    </div>
                )}
            </div>

            <div className={`profile__menu ${open ? "open" : ""}`}>
                <div className="profile__info">
                    <div className="profile__name">{session.displayName}</div>
                    {/* Email not always available in session, using generic placeholder or role */}
                    <div className="profile__email">User</div>
                </div>

                <Link href="/dashboard" className="profile__item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    Dashboard
                </Link>

                <Link href={`/u/${session.userId}`} className="profile__item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile
                </Link>

                <div className="profile__divider"></div>

                <button onClick={handleLogout} className="profile__item profile__item--danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign Out
                </button>
            </div>
        </div>
    );
}
