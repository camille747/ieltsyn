# Security

Do not put API Keys, private configuration, personal responses, recordings or complete backups in issues, pull requests or commits. API requests are handled through a loopback-only local service. This is a desktop/local application, not a multi-user hosted service.

The Key is stored as a private local file with owner-only permissions (0600). It is not encrypted against another program already running as the same operating-system user. Use a separate OS account if the computer is shared. Remove or rotate a Key in the Alibaba console if it is disclosed.

Changing or deleting study records in the UI does not revoke the provider's Key. Model requests send the selected content to Alibaba only after an explicit generation/transcription action. Local recording and PDF export do not require a Key.

Please report a suspected vulnerability through GitHub's private vulnerability reporting when enabled; otherwise contact the repository owner privately. Do not post exploit details with real user data in a public issue.
