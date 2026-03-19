#ifndef UDS_SERVICES_H
#define UDS_SERVICES_H

#include <cstdint>

namespace ev_diag {
namespace uds {

// ISO 14229 UDS service IDs
constexpr uint8_t SID_DIAGNOSTIC_SESSION_CONTROL = 0x10;
constexpr uint8_t SID_ECU_RESET                 = 0x11;
constexpr uint8_t SID_READ_DATA_IDENTIFIER      = 0x22;
constexpr uint8_t SID_READ_MEMORY_BY_ADDRESS    = 0x23;
constexpr uint8_t SID_TESTER_PRESENT            = 0x3E;
constexpr uint8_t SID_READ_DTC                  = 0x19;
constexpr uint8_t SID_CLEAR_DTC                 = 0x14;

// DiagnosticSessionControl subfunctions
constexpr uint8_t DS_EXTENDED_DIAGNOSTIC_SESSION = 0x03;

// ReadDTC subfunctions
constexpr uint8_t RDTC_REPORT_DTC_BY_STATUS_MASK = 0x02;
constexpr uint8_t RDTC_STATUS_MASK_ALL          = 0xFF;

// ClearDTC
constexpr uint8_t CDTC_GROUP_OF_DTC_ALL         = 0xFF;
constexpr uint8_t CDTC_GROUP_MASK_ALL           = 0xFF;

// Example DIDs (vehicle-specific)
constexpr uint16_t DID_VIN                     = 0xF190;
constexpr uint16_t DID_ECU_SW_VERSION          = 0xF194;
constexpr uint16_t DID_BATTERY_SOC              = 0x5B3F;

// OBD2 default request/response IDs (11-bit)
constexpr uint32_t OBD_REQUEST_ID              = 0x7DF;
constexpr uint32_t OBD_RESPONSE_ID             = 0x7E8;

}  // namespace uds
}  // namespace ev_diag

#endif  // UDS_SERVICES_H
