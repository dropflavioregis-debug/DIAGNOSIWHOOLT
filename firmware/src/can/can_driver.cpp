#include "can_driver.h"
#include "config/config.h"
#include <driver/twai.h>
#include <cstring>

namespace ev_diag {

static bool s_started = false;

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

}  // namespace ev_diag
