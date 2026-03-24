#include "can_driver.h"
#include "config/config.h"
#include <driver/twai.h>
#include <cstring>

namespace ev_diag {

static bool s_started = false;
static int s_txGpio = -1;
static int s_rxGpio = -1;
static int s_speedKbps = 0;

bool canInit(int txGpio, int rxGpio, int speedKbps) {
  if (s_started) return true;

  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(
    (gpio_num_t)txGpio,
    (gpio_num_t)rxGpio,
    TWAI_MODE_NORMAL
  );
  g_config.tx_queue_len = 8;
  g_config.rx_queue_len = 16;

  twai_timing_config_t t_config;
  switch (speedKbps) {
    case 125:
      t_config = TWAI_TIMING_CONFIG_125KBITS();
      break;
    case 250:
      t_config = TWAI_TIMING_CONFIG_250KBITS();
      break;
    case 500:
    default:
      t_config = TWAI_TIMING_CONFIG_500KBITS();
      break;
    case 1000:
      t_config = TWAI_TIMING_CONFIG_1MBITS();
      break;
  }

  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  esp_err_t e = twai_driver_install(&g_config, &t_config, &f_config);
  if (e != ESP_OK) return false;
  e = twai_start();
  if (e != ESP_OK) {
    twai_driver_uninstall();
    return false;
  }
  s_started = true;
  s_txGpio = txGpio;
  s_rxGpio = rxGpio;
  s_speedKbps = speedKbps;
  return true;
}

bool canSend(uint32_t id, uint8_t len, const uint8_t* data) {
  if (!s_started || len > 8 || data == nullptr) return false;

  twai_message_t msg = {};
  msg.identifier = id;
  msg.extd = (id > 0x7FF) ? 1 : 0;
  msg.data_length_code = len;
  std::memcpy(msg.data, data, len);

  return twai_transmit(&msg, 0) == ESP_OK;
}

bool canReceive(uint32_t* id, uint8_t* len, uint8_t* data, size_t dataMaxLen, bool* extd_out) {
  if (!s_started || id == nullptr || len == nullptr || data == nullptr || dataMaxLen < 8)
    return false;

  twai_message_t msg;
  if (twai_receive(&msg, 0) != ESP_OK)  // 0 = non-blocking
    return false;

  *id = msg.identifier;
  *len = msg.data_length_code;
  if (extd_out) *extd_out = (msg.extd != 0);
  size_t copyLen = (msg.data_length_code < dataMaxLen) ? msg.data_length_code : dataMaxLen;
  std::memcpy(data, msg.data, copyLen);
  return true;
}

void canStop() {
  if (!s_started) return;
  twai_stop();
  twai_driver_uninstall();
  s_started = false;
}

bool canIsStarted() {
  return s_started;
}

int canGetSpeedKbps() {
  return s_speedKbps;
}

bool canReconfigureSpeed(int speedKbps) {
  if (s_txGpio < 0 || s_rxGpio < 0) return false;
  if (s_started) canStop();
  return canInit(s_txGpio, s_rxGpio, speedKbps);
}

bool canGetStatus(CanStatus* outStatus) {
  if (!outStatus || !s_started) return false;
  twai_status_info_t statusInfo = {};
  if (twai_get_status_info(&statusInfo) != ESP_OK) return false;
  outStatus->started = s_started;
  outStatus->speedKbps = s_speedKbps;
  outStatus->rxMissCount = statusInfo.rx_missed_count;
  outStatus->txErrorCounter = statusInfo.tx_error_counter;
  outStatus->rxErrorCounter = statusInfo.rx_error_counter;
  outStatus->txFailedCount = statusInfo.tx_failed_count;
  outStatus->rxOverrunCount = statusInfo.rx_overrun_count;
  outStatus->arbLostCount = statusInfo.arb_lost_count;
  outStatus->busErrorCount = statusInfo.bus_error_count;
  outStatus->busOff = (statusInfo.state == TWAI_STATE_BUS_OFF);
  outStatus->recovering = (statusInfo.state == TWAI_STATE_RECOVERING);
  return true;
}

}  // namespace ev_diag
