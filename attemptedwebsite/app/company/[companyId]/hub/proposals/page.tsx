import ProposalsClient from "./ProposalsClient";

export default function CompanyProposalsPage() {
    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-semibold">Proposals</h2>
                <p className="text-sm text-[color:var(--color-muted)]">
                    Review proposals submitted by company members.
                </p>
            </header>

            <ProposalsClient />
        </div>
    );
}
