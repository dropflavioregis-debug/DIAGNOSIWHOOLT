#ifndef SESSION_STATE_H
#define SESSION_STATE_H

#include <cstddef>

namespace ev_diag {

// Max length for session_id (UUID string + NUL)
constexpr size_t SESSION_ID_MAX_LEN = 40;

// Call when user taps "Avvia connessione con veicolo". Next ingest will create a new session.
void sessionForceNew();

// True if next ingest should not send session_id (start new session). Cleared after one ingest.
bool sessionShouldStartNew();

// After reading ingest response, call this to clear the "force new" flag so we don't create sessions every time.
void sessionClearForceNew();

// Current session_id (from last ingest response). Empty until first successful ingest.
const char* sessionGetId();

// Store session_id from ingest response. Call from main after successful ingest.
void sessionSetId(const char* id);

}  // namespace ev_diag

#endif  // SESSION_STATE_H
