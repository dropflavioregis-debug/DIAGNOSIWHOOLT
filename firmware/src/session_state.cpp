#include "session_state.h"
#include <cstring>

namespace ev_diag {

static char s_session_id[SESSION_ID_MAX_LEN] = { 0 };
static bool s_force_new = false;

void sessionForceNew() {
  s_force_new = true;
  s_session_id[0] = '\0';
}

bool sessionShouldStartNew() {
  return s_force_new;
}

void sessionClearForceNew() {
  s_force_new = false;
}

const char* sessionGetId() {
  return s_session_id;
}

void sessionSetId(const char* id) {
  if (!id) {
    s_session_id[0] = '\0';
    return;
  }
  strncpy(s_session_id, id, SESSION_ID_MAX_LEN - 1);
  s_session_id[SESSION_ID_MAX_LEN - 1] = '\0';
}

}  // namespace ev_diag
