---
title: C++ fftw库的使用
publishDate: 2024-01-27 13:55:10
description: ' C++ fftw库的使用 '
language: '中文'
tags:
  - Boost
  - linux
  - fft
---
# fftw库
FFTW ( the Faster Fourier Transform in the West) 是一个快速计算离散傅里叶变换的标准C语言程序集，其由MIT的M.Frigo 和S. Johnson 开发。可计算一维或多维实和复数据以及任意规模的DFT。如果你的输入信号的采样频率是Fs，你执行了N点的FFT，那么结果数组的第i个元素对应的频率是i*Fs/N
## fftw库的下载安装
~~~python

tar -xzvf fftw-3.3.8.tar.gz

./configure --prefix=/home/xxx/usr/fftw --enable-mpi --enable-openmp --enable-threads --enable-shared MPICC=mpicc CC=gcc F77=gfortran

make

make install

export LD_LIBRARY_PATH=/home/xxx/usr/fftw/lib:$LD_LIBRARY_PATH

~~~
## fftw库的使用
**头文件**

~~~ c++
#include <fftw3.h>
~~~

**进行fft**

~~~c++
void fft(std::vector<std::complex<double>>& a) {

vector<Complex> temp(N);

fftw_complex* data = reinterpret_cast<fftw_complex*>(a.data());

fftw_complex* data1 = reinterpret_cast<fftw_complex*>(temp.data());

fftw_plan p = fftw_plan_dft_1d(N, data, data1, FFTW_FORWARD, FFTW_ESTIMATE);

fftw_execute(p);

a.assign(temp.begin(),temp.end());

}
~~~
2维同理


---