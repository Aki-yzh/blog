---
title: C++ Boost：：asio库的使用
publishDate: 2024-01-27 13:55:10
description: ' C++ Boost：：asio库的使用 '
language: '中文'
tags:
  - Boost
  - linux
---
# Boost库
 boost 库是一个优秀的，可移植的，开源的 C++ 库，它是由 C++ 标准委员会发起的，其中一些内容已经成为了下一代 C++ 标准库的内容，在 C++ 社区中影响甚大，是一个不折不扣的准标准库，它的功能十分强大，弥补了 C++ 很多功能函数处理上的不足。
## Boost库的下载安装
~~~python
wget https://dl.bintray.com/boostorg/release/1.76.0/source/boost_1_76_0.tar.gz

tar -xzvf boost_1_76_0.tar.gz

./bootstrap.sh --prefix=/usr/local

./b2 install
~~~
## Boost库的使用
**头文件**
~~~ c++
#include <boost/asio.hpp>
~~~
**tcp操作**
~~~c++
//tcp connect
boost::asio::io_service io_service;

tcp::acceptor acceptor(io_service, tcp::endpoint(tcp::v4(), 5001));

tcp::socket socket(io_service);


acceptor.accept(socket);

// Set input buffer size

boost::asio::socket_base::receive_buffer_size option(1028 * Para.FRAME_SIZE);

socket.set_option(option);

......

std::vector<short> data(whole_num * for_nums);

// 读取数据

boost::asio::read(socket, boost::asio::buffer(data));

~~~
**串口操作**
~~~c++
boost::asio::io_service io;

boost::asio::serial_port serial(io);

// 打开串口设备

serial.open("/dev/ttyUSB1");

// 设置波特率

serial.set_option(boost::asio::serial_port::baud_rate(3000000));

// 发送指令

std::string instruction = "scan start -1 stream_on adc lvds\n";

//std::vector<int> instruction(instruction_str.begin(),instruction_str.end());

boost::asio::write(serial, boost::asio::buffer(instruction));
~~~

---
