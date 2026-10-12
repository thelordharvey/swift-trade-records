<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use an account-scoped MetaTrader EA and hashed ingestion key for broker syncing; never request broker passwords because the terminal already holds the broker session.
- Keep the guided connection flow in a dedicated component using existing account queries, so account management and CSV import remain available.
